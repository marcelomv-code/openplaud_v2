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

O script pode ser interrompido e reexecutado: por padrao ele pula treinos ja
baixados, entao da pra retomar de onde parou.
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
EXPORT_URL = f"{BASE_URL}/api/export/training/{{fmt}}/{{training_id}}"

# Eventos do calendario que representam um treino baixavel.
EXERCISE_TYPES = {"EXERCISE", "TRAINING_SESSION", "FITNESS_TEST"}

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)


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
# Autenticacao
# --------------------------------------------------------------------------- #
def build_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})
    return session


def find_csrf_token(html: str) -> str | None:
    """Tenta extrair um token CSRF da pagina de login, se existir."""
    for pattern in (
        r'name="csrfToken"\s+value="([^"]+)"',
        r'name="_csrf"\s+value="([^"]+)"',
        r'"csrfToken"\s*:\s*"([^"]+)"',
    ):
        m = re.search(pattern, html)
        if m:
            return m.group(1)
    return None


def login(session: requests.Session, username: str, password: str) -> None:
    """Autentica na conta do Polar Flow. Lanca RuntimeError em caso de falha."""
    page = session.get(LOGIN_PAGE_URL, timeout=30)
    payload = {"email": username, "password": password}
    token = find_csrf_token(page.text)
    if token:
        payload["csrfToken"] = token

    resp = session.post(
        LOGIN_POST_URL,
        data=payload,
        headers={"Referer": LOGIN_PAGE_URL},
        timeout=30,
    )

    if resp.status_code >= 400:
        raise RuntimeError(
            f"Login retornou HTTP {resp.status_code}. "
            "Verifique usuario/senha."
        )

    # Verificacao real: pedir o calendario de um dia. Se a sessao nao estiver
    # autenticada, o Polar devolve HTML de login no lugar de JSON.
    if not _is_logged_in(session):
        raise RuntimeError(
            "Nao foi possivel autenticar. Confira o e-mail e a senha. "
            "Se voce usa login social (Google/Apple) ou 2FA, sera preciso "
            "uma senha de conta Polar tradicional para este metodo."
        )


def _is_logged_in(session: requests.Session) -> bool:
    today = date.today()
    try:
        resp = session.get(
            CALENDAR_URL,
            params={"start": fmt_api_date(today), "end": fmt_api_date(today)},
            timeout=30,
        )
        resp.json()
        return True
    except (ValueError, requests.RequestException):
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
    training_id = event.get("listItemId") or event.get("id")
    return f"{when}_{sport}_{training_id}.{ext}"


def download_training(
    session: requests.Session,
    event: dict,
    output_dir: str,
    fmt: str,
    overwrite: bool,
    delay: float,
) -> str:
    """Baixa um treino. Retorna 'ok', 'skip' ou 'fail'."""
    training_id = event.get("listItemId") or event.get("id")
    if not training_id:
        return "fail"

    filename = build_filename(event, fmt)
    path = os.path.join(output_dir, filename)
    if os.path.exists(path) and not overwrite:
        return "skip"

    url = EXPORT_URL.format(fmt=fmt, training_id=training_id)
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
    args = parse_args(argv)
    start, end = resolve_date_range(args)
    username, password = resolve_credentials(args)

    os.makedirs(args.output, exist_ok=True)

    print(f"Intervalo: {start.isoformat()} -> {end.isoformat()}")
    print(f"Formato:   {args.format}")
    print(f"Destino:   {os.path.abspath(args.output)}")
    print("Autenticando no Polar Flow...")

    session = build_session()
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
            tid = event.get("listItemId") or event.get("id")
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
