# Roteiro de PowerPoint — Treinamento IPC (Azure DevOps)
## Público-alvo: Usuário de TI da Braskem que atua como ponto focal do projeto para os usuários de negócio
**Projeto:** Implementação SAP S/4HANA — Braskem × Accenture
**Camada autoritativa:** Governança Vigente da Instância Braskem (Base IPC v5, §16)
**Como usar este roteiro:** cada slide tem três blocos — **[TELA]** o que aparece no slide · **[FALA]** o que o apresentador diz · **[DICA]** observação de facilitação.

> Convenção de marcação no roteiro:
> **[FATO]** = está cravado nos documentos / configuração da instância ·
> **[A CONFIRMAR]** = recomendação aderente à governança, mas pendente de validação do PMO.

---

## BLOCO 0 — Abertura (slides 1–3)

### Slide 1 — Capa
**[TELA]**
- Título: **IPC — A ferramenta de execução do projeto S/4HANA**
- Subtítulo: *Treinamento para Pontos Focais de TI*
- Rodapé: Braskem × Accenture · Base de governança v5 · Data

**[FALA]** "Este treinamento é para quem vai ser a ponte entre o IPC e os usuários de negócio. No fim, você vai saber explicar para o seu time **o que é, por que usar, como usar, quem usa e quando usar** o IPC — e vai saber resolver as dúvidas mais comuns sem precisar escalar tudo para o PMO."

**[DICA]** Pergunte na sala quem já abriu o IPC alguma vez. Calibra o ritmo.

---

### Slide 2 — Quem é você nesta história (papel do ponto focal)
**[TELA]**
- "Você é o **multiplicador**: traduz a operação do negócio para a estrutura do IPC."
- Suas 3 entregas como ponto focal:
  1. Garantir que o time **registra o trabalho no IPC** (não no e-mail).
  2. Garantir que o registro respeita a **estrutura governada**.
  3. Ser o **primeiro nível de suporte** e saber o que escalar.

**[FALA]** "Você não precisa ser administrador do Azure DevOps. Precisa entender a lógica do modelo bem o suficiente para orientar o key user e para perceber quando algo está sendo feito fora do padrão."

---

### Slide 3 — Agenda
**[TELA]**
1. O que é o IPC (e o que **não** é)
2. Por que usar
3. Os 5 work items que você precisa dominar: **Requirement, Milestone, Deliverable, Task, Decision**
4. Como tudo se conecta (hierarquia + dimensões)
5. Como o IPC enxerga o projeto: Value Stream, Frente, Geografia, Testes, Gaps/Retrofits, Migração de Dados, Pendências
6. Quem pode usar (papéis)
7. Quando usar (o rito diário)
8. Mão na massa + erros comuns

---

## BLOCO 1 — O QUE É (slides 4–6)

### Slide 4 — O que é o IPC
**[TELA]**
- IPC = instância **customizada de Azure DevOps / Azure Boards** usada como **camada de execução granular** do programa.
- É onde o trabalho **acontece e é registrado** no dia a dia.
- Roda sobre o processo `AIDTDefault`.

**[FALA]** "IPC é o nome que damos à nossa instância do Azure DevOps. Não é o Azure DevOps 'de fábrica': ele foi configurado especificamente para este projeto, com tipos de item, campos e regras próprios da Braskem."

**[DICA]** Evite jargão 'Azure Boards' com o negócio — para eles, é "o IPC".

---

### Slide 5 — IPC × MS Project (o que é de cada um)
**[TELA]** Tabela:
| MS Project | IPC |
|---|---|
| Cronograma **formal** e baseline macro | **Execução** granular do dia a dia |
| Predecessoras / cadeia de datas | Links *Related* = rastreabilidade (**não empurram data**) |
| Alterado só por PMO (Vieira/Muniz) | Times atualizam suas tasks diariamente |
| Fonte da verdade de **prazo** | Fonte da verdade de **andamento** |

**[FALA]** "Regra de ouro: **o Project manda na data; o IPC manda no andamento.** [FATO] No IPC, quando você liga dois itens com link *Related*, isso dá rastreabilidade, mas **não move datas**. Quem move data é a predecessora, e predecessora vive no Project."

---

### Slide 6 — O que o IPC NÃO é
**[TELA]**
- ❌ Não é substituto do cronograma (Project).
- ❌ Não é e-mail nem ata — embora **substitua** o e-mail como local de acompanhamento.
- ❌ Não é um espaço livre: **não se cria qualquer tipo de item, nem estrutura nova, à vontade.**
- ❌ Não é Power BI — Power BI é a visão executiva **sobre** os dados do IPC.

**[FALA]** "Muita confusão nasce aqui. O IPC não é um quadro Kanban livre. Existe uma estrutura 'escrita na pedra' que precisa ser respeitada, senão o status do programa inteiro fica errado."

---

## BLOCO 2 — POR QUE USAR (slides 7–8)

### Slide 7 — Por que usar o IPC
**[TELA]**
- **Visibilidade real**: cada líder "se vê" no projeto (método *"agora eu me vejo"*).
- **Status confiável**: o avanço do programa (SPI, Curva S) é calculado a partir do IPC.
- **Memória do projeto**: gap, decisão, pendência e evidência ficam registrados e rastreáveis.
- **Fim do "controle paralelo"**: sem planilha pessoal, sem acompanhamento só por e-mail.

**[FALA]** "O motivo nº 1 é confiança no status. [FATO] O avanço do projeto é calculado assim: **Deliverables concluídos atualizam o % do Milestone** — 2 de 10 = 20%. Isso vira SPI e Curva S, reportados toda quinta. Se o time não atualiza o IPC, o status do programa fica cego."

---

### Slide 8 — O custo de NÃO usar (mensagem de adesão)
**[TELA]**
- Item não atualizado = status do programa **desatualizado com cara de atualizado** (pior que não ter).
- Trabalho feito fora do IPC = trabalho que, para a gestão, **não existe**.
- Estrutura criada fora do padrão = **SPI quebrado** e retrabalho.

**[FALA]** "Se o trabalho não está no IPC, ele não conta no status. E pior: um dado velho engana mais do que a ausência de dado. Por isso o combinado do programa é **'IPC primeiro'** e **atualização diária**."

---

## BLOCO 3 — OS 5 WORK ITEMS (slides 9–16)

### Slide 9 — Visão geral: os 5 que você precisa dominar
**[TELA]** Pirâmide/hierarquia:
```
Requirement (Nível 3 do cronograma)   ← estrutural / PMO
   └── Milestone (Nível 4)            ← estrutural / PMO
        └── Deliverable (Nível 5)     ← estrutural / PMO
             └── Task                 ← operacional / times
             └── Decision             ← operacional / times
```
- **Estruturais (Requirement, Milestone, Deliverable):** espelham o Project. Criação **exclusiva do PMO**.
- **Operacionais (Task, Decision e outros):** liberdade dos times, no dia a dia.

**[FALA]** "Guarde esta divisão: do Deliverable para cima é **estrutura** e só o PMO cria; do Deliverable para baixo é **operação** e o time tem liberdade. [FATO] Essa fronteira é a regra de governança mais importante de todo o IPC."

---

### Slide 10 — Requirement (Nível 3)
**[TELA]**
- **O que é:** a necessidade/escopo de alto nível; espelha o **Level 3** do cronograma.
- **Quem cria:** PMO.
- **Ciclo de vida [FATO]:** New → In Analysis → To Be Approved → Approved (+ On Hold, Cancelled, Rejected).
- **Campos-chave:** Description (obrigatório), Priority (obrigatório), Requirement Type (obrigatório), Baseline Analysis Close, Fit Gap, Complexity, SMEs, Requestor.
- **Papel do ponto focal:** ajudar a qualificar (análise, critério de aceite), **não** criar.

**[FALA]** "O Requirement é o teto da estrutura que a maioria vê. Ele tem um ciclo de aprovação — passa por análise e por 'a ser aprovado' antes de virar 'Approved'. O ponto focal ajuda a preencher análise e critério de aceite, mas a criação é do PMO."

---

### Slide 11 — Milestone (Nível 4)
**[TELA]**
- **O que é:** marco de entrega; espelha o **Level 4** do Project; é o **de-para com o cronograma**.
- **Quem cria:** **exclusivamente PMO (Vieira/Muniz)**. Novo Milestone = **comitê de mudança de baseline com a Braskem**.
- **Ciclo de vida [FATO]:** New → In Progress → Closed (+ Cancelled).
- **Campos-chave:** Milestone Type, Baseline Close, Priority, Contractual.
- **Cálculo:** o **% do Milestone vem dos Deliverables** abaixo dele.

**[FALA]** "O Milestone é sagrado: é ele que conversa com o Project. [FATO] Por isso, criar um Milestone novo não é tarefa de ninguém do time — exige comitê de baseline com a Braskem. Se alguém pedir 'cria um milestone pra mim', a resposta é: isso vai para o PMO."

---

### Slide 12 — Deliverable (Nível 5) — o coração do controle
**[TELA]**
- **O que é:** o entregável concreto que satisfaz o Milestone; espelha o **Level 5**.
- **Quem cria:** **exclusivamente PMO.**
- **Ciclo de vida [FATO]:** New → In Draft → In Review → In Signoff → Complete (+ On Hold, Rework, Cancelled).
- **Stage-gate embutido:** datas de Draft / Review / Signoff / Close, cada uma com Baseline, Forecast (Target) e Actual.
- **Papéis no item:** Reviewer (obrig. em Review/Signoff/Complete), Approver (obrig. em Signoff/Complete).

**[FALA]** "O Deliverable é onde o controle realmente mora. Ele tem um mini stage-gate: rascunho → revisão → sign-off → concluído, cada etapa com data planejada (baseline), prevista (forecast) e realizada (actual). [FATO] Tem revisor e aprovador obrigatórios nas etapas finais. **É a conclusão dos Deliverables que move o % do Milestone e o SPI.**"

**[DICA]** Este é o slide mais importante do bloco. Vá devagar.

---

### Slide 13 — Task — onde o time trabalha
**[TELA]**
- **O que é:** a unidade operacional de trabalho, **embaixo do Deliverable**.
- **Quem cria:** **os próprios funcionais/times** (dia a dia, manual).
- **Ciclo de vida [FATO]:** New → In Progress → In Review → Closed (+ Cancelled).
- **Campos-chave:** Assigned To (preenchido automaticamente com você na criação), Task Type (obrigatório), Braskem Responsible, datas Baseline/Forecast/Actual.
- **Caso especial:** Task Type = *Mitigation Action* torna obrigatórios Mitigation Action Type e Prioritization.

**[FALA]** "A Task é onde o seu key user vai viver. [FATO] Aqui há liberdade total: o time cria, atribui e fecha suas tasks no dia a dia, manualmente. Carga em massa virou **exceção** (só o PMO, para grandes volumes, com SLA de 2–3 dias). O recado para o negócio: 'sua task é sua responsabilidade diária'."

---

### Slide 14 — Decision — registrar o que foi decidido
**[TELA]**
- **O que é:** registro formal de uma **decisão** de projeto (e seu racional).
- **Quem cria:** times / governança, conforme o tema.
- **Ciclo de vida [FATO]:** New → In Progress → Complete (+ On Hold, Cancelled).
- **Campos-chave:** Decision Type (obrigatório), Decision rationale, Resolution, Priority (obrigatório), Baseline Close.
- **Para que serve no dia a dia:** transformar "ficou combinado em reunião" em algo **rastreável e auditável**.

**[FALA]** "A Decision evita a frase fatal 'mas a gente tinha combinado...'. [FATO] Quando uma reunião gera uma decisão, ela vira um item Decision, com o racional e a resolução. Isso protege o time e dá memória ao projeto. Dúvida de reunião **sem acordo** com o par não vira Decision — vira item de triagem para a governança qualificar."

---

### Slide 15 — Os 5 lado a lado (tabela de bolso)
**[TELA]** Tabela:
| Item | Nível | Quem cria | Ciclo resumido | Pergunta que responde |
|---|---|---|---|---|
| Requirement | L3 | PMO | New→Analysis→Approved | "O que precisa ser entregue?" |
| Milestone | L4 | PMO | New→In Progress→Closed | "Qual o marco e a data?" |
| Deliverable | L5 | PMO | Draft→Review→Signoff→Complete | "O entregável ficou pronto?" |
| Task | operacional | Time | New→In Progress→Closed | "Quem faz o trabalho?" |
| Decision | operacional | Time/Gov. | New→In Progress→Complete | "O que foi decidido e por quê?" |

**[FALA]** "Esse é o slide que você vai mandar no chat do time. Se decorar só isto, já resolve 80% das dúvidas."

---

### Slide 16 — Como os 5 se relacionam (diagrama)
**[TELA]** Diagrama de relacionamento:
```
Requirement ──contém──► Milestone ──contém──► Deliverable
                                                  │
                          ┌───────────────────────┼───────────────────────┐
                          ▼                        ▼                        ▼
                        Task                    Decision               (Bug, RICEFW,
                    (executa)                (registra escolha)        Test, Block...)

% das Tasks/Deliverables  ─►  % do Deliverable  ─►  % do Milestone  ─►  SPI / Curva S
Links "Related" = rastreabilidade lateral (NÃO empurram data)
```

**[FALA]** "A hierarquia é de **conteúdo** (pai contém filho), e o **avanço sobe** de baixo para cima: Deliverable conclui → Milestone avança → SPI move. As ligações laterais entre itens diferentes usam link *Related*, só para rastrear — nunca para mover prazo."

---

## BLOCO 4 — COMO O IPC ENXERGA O PROJETO (slides 17–25)

### Slide 17 — As 3 dimensões que organizam tudo
**[TELA]** Tabela mestre:
| Dimensão | Significa | Exemplo |
|---|---|---|
| **Iteration Path** | **Frente/cronograma** — de-para **1:1 com o Project** | Realize ▸ SIT1 ▸ Execution |
| **Area Path** | **Responsabilidade pela entrega** (quem entrega) | Order to Cash; Data Migration; BASIS |
| **TAG** | **Visibilidade transversal** (corte que cruza tudo) | `FitGap`, `DataMigration`, `TaxReform` |

**[FALA]** "Toda dúvida de 'onde coloco isso?' se resolve com estas três perguntas: **Em que fase/frente?** → Iteration Path. **Quem é responsável?** → Area Path. **Que corte transversal eu quero enxergar depois?** → TAG. [FATO] E a regra de ouro: **corte transversal é sempre TAG, nunca estrutura nova.**"

**[DICA]** Este slide é a "chave de tudo". Os próximos 8 são aplicações dele.

---

### Slide 18 — Relação com VALUE STREAM
**[TELA]**
- Value Stream → vive no **Area Path** (responsabilidade pela entrega).
- [FATO] Area Path ≠ só Value Stream: inclui também **times técnicos** (Security/GRC, BASIS/Arquitetura, Data Migration, Change Mgmt/GMO, PMO/Governança, Test Governance).
- Exemplos de Area Path: Order to Cash, Record to Report, Requisition to Pay, Hire to Leave...

**[FALA]** "Quando o líder pergunta 'cadê a minha value stream?', a resposta é o **Area Path**. Mas cuidado: [FATO] Area Path é mais amplo que value stream — é o eixo de **quem entrega**. Um time técnico como BASIS também tem Area Path, mesmo não sendo value stream."

---

### Slide 19 — Relação com FRENTE DE TRABALHO (workstream)
**[TELA]**
- Frente de trabalho / workstream → vive no **Iteration Path**.
- [FATO] Iteration Path tem de-para **1:1 com o Project** — é "o contrato da integração".
- A mesma frente pode existir em **Explore** e em **Realize** (espelha as fases Activate).
- [FATO] Casos especiais: **Tax Reform** e **DRC** são **workstreams** (Iteration Path), nunca value streams.

**[FALA]** "Frente de trabalho = Iteration Path. [FATO] Quebrar esse de-para 1:1 com o Project destrói o sync que roda 2x por dia e quebra o SPI. Por isso ninguém inventa Iteration Path. E atenção a Tax Reform e DRC: são frentes, não value streams — erro comum."

---

### Slide 20 — Relação com GEOGRAFIA DA BRASKEM
**[TELA]**
- [A CONFIRMAR com PMO] Geografia (Brasil, EUA, etc.) **não é** hierarquia própria no modelo atual.
- Recomendação aderente à governança: representar geografia como **TAG transversal** (ex.: `Geo-Brasil`, `Geo-US`).
- Motivo: geografia cruza várias value streams e frentes → é, por definição, um **corte transversal** → TAG.

**[FALA]** "Aqui preciso ser transparente: a geografia **não está cravada** como dimensão nos documentos do projeto, diferente de value stream e frente. Pela regra 'transversal = TAG', a forma correta de enxergar por geografia é **TAG + filtro**, e **não** criar Area Path ou Iteration Path novo por país. **Isto é um ponto a confirmar com o PMO** antes de padronizar."

**[DICA]** Seja honesto sobre o "a confirmar" — dá credibilidade ao treinamento.

---

### Slide 21 — Relação com PLANO E CENÁRIOS DE TESTE
**[TELA]**
- **Estratégia/planejamento** de teste → **Test Governance** (Area Path).
- **Execução** → nas Value Streams (Area Path da VS).
- Frentes/fases de teste → **Iteration Path**: Product Testing, SIT1, SIT2, UAT (com Planning/Execution/Closure).
- Itens nativos: **Test Plan, Test Case, Test Suite**; defeitos = **Bug**; bloqueio = **Block**/TAG `TestBlocker`.
- Corte transversal: TAG `SIT1`, `SIT2`.

**[FALA]** "Teste tem duas mãos: [FATO] **a estratégia é da Test Governance (Fabiana); a execução é da VS**. Os planos de teste ficam separados por VS no Area Path. O cenário/fase (SIT1, SIT2, UAT) é Iteration Path. E o bug encontrado vira um work item Bug, ligado ao item testado."

---

### Slide 22 — Relação com GAPS E RETROFITS
**[TELA]**
- [FATO] Gap **não é** frente nem Iteration Path. **Gap real ≈ RICEFW.**
- Representação: **Deliverable (nomeado como gap) criado SOB o item afetado**, com **Tasks** embaixo (especificação, código, teste).
- Reporte: por **TAG** (ex.: `FitGap`) / filtro — avaliar deliverable type "Fit Gap Analysis".
- Retrofit: aparece como frente no Iteration Path ("Retrofit Remediation and Gap").
- [FATO] A **lista legada de gaps** ("lista do Júlio", 142 itens) está **encerrada** — nada novo nasce lá.

**[FALA]** "Esse é campeão de erro. Gap **não** é uma frente nova nem uma lista paralela. [FATO] Gap vira um **Deliverable embaixo do item afetado** (ex.: do botão), com tasks de especificação, código e teste, e é reportado por TAG. A lista antiga de pendências está **morta**: item novo lá é erro de processo."

---

### Slide 23 — Relação com OBJETOS DE MIGRAÇÃO DE DADOS
**[TELA]**
- Existe o work item type **Data Object**.
- Responsabilidade do time executor → **Area Path "Data Migration"** (com subáreas: Financeiro/Controladoria, Logística/Transporte, Suprimentos/Compras, Vendas).
- Quando a responsabilidade é da VS, mas o tema é migração → Area Path da VS **+ TAG `DataMigration`**.
- Frentes/ciclos → Iteration Path: Pre Mock, Mock 1, Mock 2, Production Data Load.
- **Data owners**: acesso **limitado ao próprio escopo**.

**[FALA]** "Migração de dados tem item próprio (Data Object) e Area Path próprio. [FATO] A regra de decisão é: **quem é responsável pela entrega?** Se é o time de Data Migration → Area Path Data Migration. Se é a VS, mas o tema é migração → Area Path da VS + TAG DataMigration. Area Path é **responsabilidade**, não assunto."

---

### Slide 24 — Relação com PENDÊNCIAS GERAIS DO PROJETO
**[TELA]**
- Pendência **não** é um "balaio único". Cada tipo tem seu lugar:
  | Natureza | Item correto |
  |---|---|
  | Trabalho a fazer | **Task** |
  | Decisão a registrar | **Decision** |
  | Obstáculo | **Impediment / Issue** |
  | Defeito | **Bug** |
  | Gap real | **Deliverable** (sob o item afetado) |
- Dúvida de reunião sem acordo → **item de triagem** para a governança classificar (gap / risco / matar).

**[FALA]** "'Pendência' é uma palavra perigosa porque vira balaio. [FATO] No IPC, você classifica: é trabalho? Task. É decisão? Decision. É obstáculo? Impediment. É defeito? Bug. É gap? Deliverable sob o item. Se nem você nem o par sabem o que é, abre um **item de triagem** e a governança qualifica."

---

### Slide 25 — Mapa de bolso: assunto → onde colocar
**[TELA]** Tabela-resumo (a "cola" do ponto focal):
| Assunto | Iteration Path (frente) | Area Path (responsável) | TAG (transversal) | Item típico |
|---|---|---|---|---|
| Value Stream | fase da VS | a própria VS | — | Deliverable/Task |
| Frente/workstream | a frente | VS ou time técnico | — | Deliverable/Task |
| Geografia [A CONFIRMAR] | — | — | `Geo-*` | (qualquer) |
| Teste | SIT1/SIT2/UAT | Test Gov. (plano) / VS (execução) | `SIT1` | Test/Bug |
| Gap/Retrofit | (do item afetado) | VS dona | `FitGap` | Deliverable+Task |
| Migração de dados | Mock/Pre Mock | Data Migration ou VS | `DataMigration` | Data Object/Task |
| Pendência geral | (conforme) | (conforme) | (conforme) | Task/Decision/Issue |

**[FALA]** "Imprima este slide. É o seu mapa de decisão para qualquer dúvida do tipo 'onde eu coloco isso?'."

---

## BLOCO 5 — QUEM PODE USAR (slides 26–28)

### Slide 26 — Os papéis e o que cada um faz no IPC
**[TELA]** Tabela de papéis:
| Papel | O que faz no IPC | O que NÃO faz |
|---|---|---|
| **Líder de TI** | Consome estrutura, queries, painéis, workload; apoia tecnicamente | Não precisa de treino DevOps profundo; não cria estrutura |
| **Líder de Value Stream** | "Se vê" no IPC; acompanha Deliverables/Tasks da sua VS; cobra atualização | Não cria Milestone/Deliverable |
| **PIL (Process Implementation Lead)** | Conduz a implementação do processo; qualifica Requirements; gere Deliverables/Tasks da frente | Não altera o de-para com o Project |
| **Data Owner** | Mantém objetos de migração no **seu escopo**; qualidade do dado | Acesso **limitado ao próprio escopo**; não mexe em cronograma |
| **Profile Owner** | Donos de perfis/roles de acesso (Security/GRC) | Restrito ao domínio de acesso |
| **Key User** | Edita sua Task, abre Bug, fecha, anexa evidência, valida teste | Não cria estrutura; opera o dia a dia |

**[FALA]** "Repare no padrão: [FATO] **quanto mais estrutural o item, mais restrito quem mexe.** Líderes de VS e PILs operam e cobram, mas **não criam Milestone/Deliverable** — isso é PMO. Data owner tem acesso de propósito **limitado ao próprio escopo**, para não afetar cronograma e SPI por engano."

---

### Slide 27 — Acesso e permissões (o lado técnico)
**[TELA]**
- [FATO] Perfil mínimo seguro para criar/manter query e chart: **Basic access**. *Stakeholder* tem limitações.
- Query compartilhada exige **Contribute** na pasta **Shared Queries**.
- [FATO] Edição em massa = restrita ao **núcleo de confiança**.
- [FATO] Pedido de **carga/acesso** → **canal oficial**, SLA real **2–3 dias**. Última hora não é atendido.

**[FALA]** "O ponto focal precisa saber duas coisas práticas: (1) para criar dashboards e queries compartilhadas, o usuário precisa de **Basic** + **Contribute** na pasta certa; (2) acesso e carga têm **SLA de 2–3 dias por canal oficial** — então oriente o time a pedir com antecedência."

---

### Slide 28 — Onde fica a fronteira da governança (regra dos 4 "nunca")
**[TELA]**
1. **Nunca** crie Milestone/Deliverable fora do PMO.
2. **Nunca** crie Area Path/Iteration Path para fazer relatório (use TAG).
3. **Nunca** quebre o de-para 1:1 do Iteration Path com o Project.
4. **Nunca** registre pendência na lista legada (está morta).

**[FALA]** "Se o seu time gravar só estes quatro 'nunca', o SPI do programa fica protegido. Tudo o mais é operação e tem liberdade."

---

## BLOCO 6 — QUANDO USAR (slides 29–30)

### Slide 29 — O rito "IPC primeiro"
**[TELA]**
- [FATO] **Reuniões de trabalho acontecem dentro do IPC.** E-mail só documenta.
- Gap/tema levantado em reunião = **cadastrado na hora**, com plano.
- [FATO] **Atualização diária** das tasks pelos funcionais.
- Status do programa: report às **quintas** (SPI/Curva S, produzido pelo PMO).
- E-mail de "de acordo" dos pares Braskem = proteção documental.

**[FALA]** "O 'quando' é simples: **o tempo todo, e primeiro.** [FATO] A combinação do programa é reunião dentro do IPC, cadastro na hora, atualização diária. O e-mail não sumiu — mas ele **documenta**, não **substitui** o IPC."

---

### Slide 30 — A rotina do ponto focal (semana típica)
**[TELA]**
- **Diário:** garantir que o time atualizou suas Tasks; registrar decisões/gaps na hora.
- **Antes da reunião:** abrir a query/painel da frente; checar itens sem owner, atrasados, sem baseline.
- **Na reunião:** registrar Decision e novas Tasks ao vivo.
- **Antes da quinta:** garantir Deliverables refletindo a realidade (alimenta o SPI).
- **Pedidos de acesso/carga:** abrir no canal oficial com **2–3 dias** de antecedência.

**[FALA]** "Essa é a sua rotina como multiplicador. O segredo não é heroísmo no fim de semana — é **consistência diária** e usar a reunião para registrar ao vivo."

---

## BLOCO 7 — MÃO NA MASSA + FECHAMENTO (slides 31–34)

### Slide 31 — Demo guiada (roteiro de tela)
**[TELA]** Passo a passo (ao vivo no IPC):
1. Abrir um Milestone e mostrar os Deliverables abaixo (e o % subindo).
2. Abrir um Deliverable e percorrer Draft → Review → Signoff (Reviewer/Approver).
3. Criar uma **Task** sob o Deliverable (Task Type, Assigned To, datas).
4. Registrar uma **Decision** (Decision Type + rationale).
5. Aplicar uma **TAG** (`FitGap`) e filtrar.
6. Abrir uma **query flat-list** em Shared Queries e o dashboard da frente.

**[FALA]** "Agora ao vivo. Reparem como a conclusão do Deliverable mexe no Milestone — é o SPI nascendo na frente de vocês."

**[DICA]** Use um item de sandbox/treino, nunca um item real de baseline.

---

### Slide 32 — Erros comuns a evitar
**[TELA]**
1. Criar Milestone/Deliverable "para se organizar" → **escale ao PMO**.
2. Criar Area/Iteration Path para um relatório → **use TAG**.
3. Confundir Area Path com Value Stream → **Area Path = responsabilidade**.
4. Tratar gap como frente/lista paralela → **Deliverable sob o item + TAG**.
5. Acompanhar por e-mail/planilha → **IPC primeiro**.
6. Pedir carga/acesso em cima da hora → **SLA 2–3 dias**.
7. Query pessoal (My Queries) como oficial → **Shared Queries**.

**[FALA]** "Esses sete erros respondem pela maioria dos chamados. Se você anular esses, vira referência da sua frente."

---

### Slide 33 — Quando escalar (e para quem)
**[TELA]**
| Situação | Ação |
|---|---|
| Precisa de novo Milestone/Deliverable | **PMO (Vieira/Muniz)** — comitê de baseline |
| Mudança no Project / data | **PMO** |
| Acesso, perfil, carga em massa | **Canal oficial** (SLA 2–3 dias) |
| Dúvida sem acordo entre pares | **Item de triagem** para a governança |
| Taxonomia de TAG nova | **Coordenar com PMO** (evitar proliferação) |
| Dashboard de SPI/Curva S | **Validar com PMO/Power BI** |

**[FALA]** "Saber escalar é parte do papel. Você resolve operação; estrutura, baseline e acesso têm dono."

---

### Slide 34 — Recados finais + recursos
**[TELA]**
- 3 frases para levar: **"IPC primeiro" · "Transversal é TAG" · "Estrutura é do PMO".**
- Hierarquia: **Requirement → Milestone → Deliverable → Task/Decision**.
- Dimensões: **Iteration = frente/Project · Area = responsabilidade · TAG = transversal**.
- Onde buscar ajuda: pílulas de ~1 min no site do projeto, sessão de Q&A, 30 min na status de segunda.

**[FALA]** "Se vocês saírem daqui com três frases — IPC primeiro, transversal é TAG, estrutura é do PMO — o treinamento cumpriu o papel. Obrigado, e vamos para as perguntas."

---

## Apêndice A — Slides opcionais/backup
- **A1 — Ciclo de vida completo de cada item** (estados e transições restritas, conforme configuração).
- **A2 — Campos obrigatórios por item na criação** (Action/Bug/Decision/Deliverable/Milestone/Requirement/Task).
- **A3 — Baseline × Forecast × Actual** (como as datas se preenchem automaticamente).
- **A4 — Como criar uma query flat-list + chart + dashboard** (passo a passo do guia de dashboards).
- **A5 — Glossário** (SPI, Curva S, baseline, RICEFW, value stream, workstream, gated %).

## Apêndice B — Pendências de validação com o PMO antes de publicar
1. **Geografia da Braskem** como dimensão: confirmar se é TAG (recomendado) ou já existe Area Path por país. *(Slide 20)*
2. **Taxonomia oficial de TAGs** (FitGap, DataMigration, TaxReform, Geo-*, SIT1...): ainda parcial na base. *(Slides 17, 25)*
3. **Lista de papéis × perfil de acesso** (Basic/Stakeholder/Contribute) por pessoa: não estava extraída com confiabilidade. *(Slide 27)*
4. **Valores de picklists** (Decision Type, Milestone Type, Task Type...): não extraídos — necessários para a demo. *(Slide 31)*
