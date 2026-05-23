#!/usr/bin/env python3
"""Exporta treinos do Polar Flow (flow.polar.com) para arquivos locais.

Baixa todas as sessoes de exercicio de um intervalo de datas (por padrao, os
ultimos 24 meses) da sua conta pessoal do Polar Flow e salva cada uma como
arquivo TCX (contem GPS, frequencia cardiaca, cadencia, etc). Tambem suporta
GPX e CSV.

------------------------------------------------------------------------------
USO BASICO
------------------------------------------------------------------------------
1) Instale a dependencia:

       pip install -r requirements.txt
       # ou simplesmente:  pip install requests

2) Informe suas credenciais por variaveis de ambiente (recomendado):

       export POLAR_USERNAME="seu-email@exemplo.com"
       export POLAR_PASSWORD="sua-senha"
       python3 polar_flow_export.py --output ./treinos

   Ou passe o usuario e digite a senha quando solicitado (nao fica no historico):

       python3 polar_flow_export.py --username seu-email@exemplo.com

------------------------------------------------------------------------------
OPCOES PRINCIPAIS
------------------------------------------------------------------------------
    --months N          Quantos meses para tras exportar (padrao: 24)
    --start DD.MM.YYYY   Data inicial explicita (sobrepoe --months)
    --end   DD.MM.YYYY   Data final (padrao: hoje)
    --output DIR         Pasta de destino (padrao: ./polar_export)
    --format FMT         tcx (padrao), gpx ou csv
    --overwrite          Rebaixa arquivos que ja existem localmente
    --delay SEGUNDOS     Pausa entre downloads (padrao: 1.0)
    --user-agent STR     User-Agent personalizado (raramente necessario)
    --cookie STR         Pula o login e usa cookies de uma sessao ja aberta
                         no navegador. Formato: "KEY=VAL; KEY2=VAL2"
    --debug             Mostra detalhes HTTP em caso de falha de login

O script pode ser interrompido e reexecutado: por padrao ele pula treinos ja
baixados, entao da pra retomar de onde parou.

------------------------------------------------------------------------------
SE O LOGIN FALHAR (HTTP 403 / nao autentica)
------------------------------------------------------------------------------
O Polar tem protecao anti-bot. Se o login com usuario/senha falhar, use o modo
cookie: abra flow.polar.com no navegador (ja logado), copie os cookies do site
e rode com --cookie "..." (veja instrucoes detalhadas no final deste arquivo).
"""

from __future__ import annotations

import argparse
import calendar
import getpass
import os
import re
import sys
import time
from datetime import date, datetime

try:
    import requests
except ImportError:  # pragma: no cover
    sys.exit(
        "Falta a biblioteca 'requests'. Instale com:\n"
        "    pip install -r requirements.txt\n"
        "ou: pip install requests"
    )

BASE_URL = "https://flow.polar.com"
LOGIN_PAGE_URL = f"{BASE_URL}/"
LOGIN_POST_URL = f"{BASE_URL}/login"
CALENDAR_URL = f"{BASE_URL}/training/getCalendarEvents"

# Eventos do calendario que representam um treino baixavel.
EXERCISE_TYPES = {"EXERCISE", "TRAINING_SESSION", "FITNESS_TEST"}

# Um User-Agent honesto (nao fingir ser um navegador) evita a regra anti-bot
# que bloqueia "Chrome falso" vindo de scripts. Foi assim que as ferramentas
# de exportacao da comunidade conseguiram passar pelo 403.
DEFAULT_USER_AGENT = "polar-flow-export/2.0 (personal data export)"

DEBUG = False


def dbg(*args) -> None:
    if DEBUG:
        print("[debug]", *args, file=sys.stderr)


# --------------------------------------------------------------------------- #
# Datas
# --------------------------------------------------------------------------- #
def months_ago(reference: date, n: int) -> date:
    """Retorna a data n meses antes de `reference`, ajustando o dia ao mes."""
    total = (reference.year * 12 + (reference.month - 1)) - n
    year, month = divmod(total, 12)
    month += 1
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(reference.day, last_day))


def iter_month_ranges(start: date, end: date):
    """Gera pares (inicio, fim) cobrindo cada mes do intervalo [start, end]."""
    cur = start
    while cur <= end:
        last_day = calendar.monthrange(cur.year, cur.month)[1]
        chunk_end = min(date(cur.year, cur.month, last_day), end)
        yield cur, chunk_end
        if cur.month == 12:
            cur = date(cur.year + 1, 1, 1)
        else:
            cur = date(cur.year, cur.month + 1, 1)


def fmt_api_date(d: date) -> str:
    return d.strftime("%d.%m.%Y")


def parse_cli_date(s: str) -> date:
    return datetime.strptime(s, "%d.%m.%Y").date()


# --------------------------------------------------------------------------- #
# Sessao / Autenticacao
# --------------------------------------------------------------------------- #
def build_session(user_agent: str, cookie: str | None) -> requests.Session:
    session = requests.Session()
    session.headers.update({"User-Agent": user_agent})
    if cookie:
        for part in cookie.split(";"):
            part = part.strip()
            if "=" in part:
                key, value = part.split("=", 1)
                session.cookies.set(key.strip(), value.strip(), domain="flow.polar.com")
    return session


def login(session: requests.Session, username: str, password: str) -> None:
    """Autentica na conta do Polar Flow. Lanca RuntimeError em caso de falha."""
    # GET inicial: estabelece cookies de sessao antes do POST.
    try:
        session.get(LOGIN_PAGE_URL, timeout=30)
    except requests.RequestException as exc:
        dbg("GET inicial falhou (seguindo mesmo assim):", exc)

    # Campos identicos aos das ferramentas que funcionam (sem CSRF).
    payload = {
        "returnUrl": "https://flow.polar.com/",
        "email": username,
        "password": password,
    }
    resp = session.post(
        LOGIN_POST_URL,
        data=payload,
        headers={
            "Referer": LOGIN_PAGE_URL,
            "Origin": BASE_URL,
        },
        timeout=30,
    )
    dbg("POST /login ->", resp.status_code, "| url final:", resp.url)

    if resp.status_code == 403:
        if DEBUG:
            dbg("corpo (inicio):", resp.text[:300])
        raise RuntimeError(
            "Login bloqueado pelo Polar (HTTP 403). Isso costuma ser protecao "
            "anti-bot, NAO senha errada.\n"
            "Solucao recomendada: use o modo --cookie (instrucoes no fim do "
            "arquivo polar_flow_export.py ou peca ajuda)."
        )
    if resp.status_code >= 400:
        raise RuntimeError(
            f"Login retornou HTTP {resp.status_code}. Verifique usuario/senha."
        )

    if not _is_logged_in(session):
        raise RuntimeError(
            "Nao foi possivel autenticar. Confira o e-mail e a senha. "
            "Se voce usa login social (Google/Apple) ou 2FA, use o modo "
            "--cookie em vez de usuario/senha."
        )


def _is_logged_in(session: requests.Session) -> bool:
    today = date.today()
    try:
        resp = session.get(
            CALENDAR_URL,
            params={"start": fmt_api_date(today), "end": fmt_api_date(today)},
            timeout=30,
        )
        dbg("verificacao getCalendarEvents ->", resp.status_code)
        resp.json()
        return True
    except (ValueError, requests.RequestException) as exc:
        dbg("verificacao falhou:", exc)
        return False


# --------------------------------------------------------------------------- #
# Listagem e download
# --------------------------------------------------------------------------- #
def fetch_events(session: requests.Session, start: date, end: date) -> list[dict]:
    resp = session.get(
        CALENDAR_URL,
        params={"start": fmt_api_date(start), "end": fmt_api_date(end)},
        timeout=60,
    )
    resp.raise_for_status()
    try:
        data = resp.json()
    except ValueError:
        raise RuntimeError(
            "Resposta inesperada ao listar treinos (sessao expirou?)."
        )
    return data if isinstance(data, list) else []


def is_exercise(event: dict) -> bool:
    return str(event.get("type", "")).upper() in EXERCISE_TYPES


def safe_slug(value: str) -> str:
    value = re.sub(r"[^A-Za-z0-9]+", "-", value).strip("-")
    return value or "treino"


def event_training_id(event: dict):
    return event.get("listItemId") or event.get("id")


def event_export_url(event: dict, fmt: str) -> str:
    """Monta a URL de exportacao a partir da URL de analise do treino.

    Ex.: https://flow.polar.com/training/analysis/123456/export/tcx/false
    """
    rel = (event.get("url") or "").strip("/")
    if not rel:
        rel = f"training/analysis/{event_training_id(event)}"
    return f"{BASE_URL}/{rel}/export/{fmt}/false"


def build_filename(event: dict, ext: str) -> str:
    raw = str(event.get("datetime", "")).strip()
    stamp = None
    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            stamp = datetime.strptime(raw, fmt)
            break
        except ValueError:
            continue
    when = stamp.strftime("%Y-%m-%d_%H%M%S") if stamp else "sem-data"
    sport = safe_slug(str(event.get("iconType") or event.get("sport") or "treino"))
    return f"{when}_{sport}_{event_training_id(event)}.{ext}"


def download_training(
    session: requests.Session,
    event: dict,
    output_dir: str,
    fmt: str,
    overwrite: bool,
    delay: float,
) -> str:
    """Baixa um treino. Retorna 'ok', 'skip' ou 'fail'."""
    training_id = event_training_id(event)
    if not training_id:
        return "fail"

    filename = build_filename(event, fmt)
    path = os.path.join(output_dir, filename)
    if os.path.exists(path) and not overwrite:
        return "skip"

    url = event_export_url(event, fmt)
    try:
        resp = session.get(url, timeout=120)
        resp.raise_for_status()
    except requests.RequestException as exc:
        print(f"  ! Falha ao baixar treino {training_id}: {exc}", file=sys.stderr)
        return "fail"

    content = resp.content
    # Alguns treinos (ex.: multiesporte) vem como zip; ajusta a extensao.
    if content[:2] == b"PK" and not path.endswith(".zip"):
        path = path.rsplit(".", 1)[0] + ".zip"

    with open(path, "wb") as fh:
        fh.write(content)

    if delay > 0:
        time.sleep(delay)
    return "ok"


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Exporta treinos do Polar Flow para arquivos locais.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--username", help="E-mail da conta Polar (ou env POLAR_USERNAME)")
    parser.add_argument("--password", help="Senha (NAO recomendado; prefira env/prompt)")
    parser.add_argument("--months", type=int, default=24, help="Meses para tras (padrao: 24)")
    parser.add_argument("--start", help="Data inicial DD.MM.AAAA (sobrepoe --months)")
    parser.add_argument("--end", help="Data final DD.MM.AAAA (padrao: hoje)")
    parser.add_argument("--output", default="./polar_export", help="Pasta de destino")
    parser.add_argument(
        "--format",
        choices=["tcx", "gpx", "csv"],
        default="tcx",
        help="Formato de exportacao (padrao: tcx)",
    )
    parser.add_argument("--overwrite", action="store_true", help="Rebaixa arquivos existentes")
    parser.add_argument("--delay", type=float, default=1.0, help="Pausa entre downloads (s)")
    parser.add_argument("--user-agent", default=DEFAULT_USER_AGENT, help="User-Agent personalizado")
    parser.add_argument(
        "--cookie",
        help='Pula login e usa cookies do navegador. Ex.: "JSESSIONID=...; AWSALB=..."',
    )
    parser.add_argument("--debug", action="store_true", help="Mostra detalhes HTTP")
    return parser.parse_args(argv)


def resolve_credentials(args: argparse.Namespace) -> tuple[str, str]:
    username = args.username or os.environ.get("POLAR_USERNAME")
    password = args.password or os.environ.get("POLAR_PASSWORD")
    if not username:
        username = input("E-mail da conta Polar: ").strip()
    if not password:
        password = getpass.getpass("Senha da conta Polar: ")
    if not username or not password:
        sys.exit("E-mail e senha sao obrigatorios.")
    return username, password


def resolve_date_range(args: argparse.Namespace) -> tuple[date, date]:
    end = parse_cli_date(args.end) if args.end else date.today()
    if args.start:
        start = parse_cli_date(args.start)
    else:
        start = months_ago(end, args.months)
    if start > end:
        sys.exit("A data inicial nao pode ser depois da data final.")
    return start, end


def main(argv: list[str]) -> int:
    global DEBUG
    args = parse_args(argv)
    DEBUG = args.debug
    start, end = resolve_date_range(args)

    os.makedirs(args.output, exist_ok=True)

    print(f"Intervalo: {start.isoformat()} -> {end.isoformat()}")
    print(f"Formato:   {args.format}")
    print(f"Destino:   {os.path.abspath(args.output)}")

    session = build_session(args.user_agent, args.cookie)

    if args.cookie:
        print("Usando cookies fornecidos (pulando login)...")
        if not _is_logged_in(session):
            sys.exit(
                "Os cookies fornecidos nao autenticam (expirados ou incompletos).\n"
                "Abra flow.polar.com no navegador, faca login e copie os cookies "
                "novamente."
            )
    else:
        username, password = resolve_credentials(args)
        print("Autenticando no Polar Flow...")
        try:
            login(session, username, password)
        except RuntimeError as exc:
            sys.exit(str(exc))
    print("Autenticado com sucesso.\n")

    totals = {"ok": 0, "skip": 0, "fail": 0}
    seen: set = set()

    for chunk_start, chunk_end in iter_month_ranges(start, end):
        label = chunk_start.strftime("%m/%Y")
        try:
            events = fetch_events(session, chunk_start, chunk_end)
        except RuntimeError as exc:
            print(f"[{label}] erro: {exc}", file=sys.stderr)
            continue

        exercises = [e for e in events if is_exercise(e)]
        print(f"[{label}] {len(exercises)} treino(s)")

        for event in exercises:
            tid = event_training_id(event)
            if tid in seen:
                continue
            seen.add(tid)
            result = download_training(
                session, event, args.output, args.format, args.overwrite, args.delay
            )
            totals[result] += 1
            if result == "ok":
                print(f"    baixado: {build_filename(event, args.format)}")

    print(
        f"\nConcluido. Baixados: {totals['ok']} | "
        f"Ja existiam: {totals['skip']} | Falhas: {totals['fail']}"
    )
    return 1 if totals["fail"] and not totals["ok"] else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))


# ===========================================================================
# COMO USAR O MODO --cookie (quando o login com senha da HTTP 403)
# ===========================================================================
# 1. No celular ou PC, abra https://flow.polar.com e faca login normalmente.
# 2. Pegue os cookies do site flow.polar.com. No PC e mais facil:
#       - Chrome/Edge: F12 -> aba "Application" -> Cookies -> flow.polar.com
#       - Copie os pares NOME=VALOR (os importantes costumam ser
#         JSESSIONID e os que comecam com AWSALB).
# 3. Rode:
#       python3 polar_flow_export.py \
#           --cookie "JSESSIONID=xxxx; AWSALB=yyyy; AWSALBCORS=zzzz" \
#           --output ./treinos
#    (nao precisa de usuario/senha nesse modo)
# ===========================================================================
