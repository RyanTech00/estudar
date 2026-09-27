# Contribuir para o Estudar

## Como contribuir

### 1. Fork e branch
- Faz fork do repositório.
- Cria uma branch a partir de `main`: `git checkout -b feat/a-tua-funcionalidade`
- Nomes: `feat/`, `fix/`, `docs/`, `refactor/`, `test/`

### 2. Desenvolver
```bash
npm install
npm start        # app + API em http://localhost:8787
npm test         # regras de aprendizagem e do percurso
npm run check    # o Worker compila
```
- Segue o estilo do código existente: sem build, ES modules, sem dependências no browser.
- Texto que vem do utilizador ou da IA é sempre escapado antes de ir para o HTML.
- Sem chaves nem segredos no código.

### 3. As regras de aprendizagem são invariantes
O que decide o que conta como aprendizagem vive em `public/js/learning.js` e `public/js/curriculum.js`, e está descrito em [docs/ciencia](docs/ciencia/index.md). Se mudares uma regra:
- diz no PR qual (R1–R9) e porquê;
- acrescenta ou atualiza o teste;
- **estraga a regra de propósito** e confirma que o teste falha.

Uma funcionalidade que entre em conflito com uma regra muda a funcionalidade, não a regra — a não ser que tragas evidência.

### 4. Documentação
- As páginas estão em `docs/` (VitePress): `cd docs && npm install && npm run dev`.
- Se mudaste a interface, regenera as capturas: `npm run screenshots` (usa um estudante fictício e o Edge ou Chrome instalados) e revê-as.
- `npm run build` falha com links ou âncoras partidos.

### 5. Pull request
- Abre o PR contra `main` e preenche o modelo.
- A CI corre os testes, o build do Worker e o build da documentação.

## Aceite
Correções, melhorias de acessibilidade, novos fornecedores de IA, traduções, documentação, desempenho.

## Não aceite
- Expor segredos no frontend.
- Resumos gerados por IA, tutores que dão respostas antes de uma tentativa, ou métricas que premeiem horas — contrariam os [princípios](docs/ciencia/index.md).
- Dependências com licenças restritivas.
- Mudanças ao formato dos dados sem migração.

## Publicar uma versão (mantenedor)
1. Sobe a versão em `package.json` (`npm version patch|minor|major --no-git-tag-version`) e acrescenta a secção ao changelog, nas duas línguas (`docs/changelog.md` e `docs/en/changelog.md`).
2. Faz commit e push para `main`.
3. Cria uma release no GitHub com a tag `vX.Y.Z` igual à versão. O workflow [`publish.yml`](.github/workflows/publish.yml) corre os testes e deixa a versão **em espera** no npm (`npm stage publish`, por Trusted Publishing, sem token).
4. Aprova-a com 2FA em npmjs.com → **Staged Packages**, ou com `npm stage list` e `npm stage approve <id>`. Só então fica pública.

## Dúvidas
Abre uma [issue](https://github.com/RyanTech00/estudar/issues).
