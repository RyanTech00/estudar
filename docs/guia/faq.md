# Perguntas frequentes

## Sobre o método

### Porque é que as horas não contam para o domínio?

Porque o tempo mede o esforço, não o que ficou. Duas horas a reler podem deixar menos do que 30 minutos a testares-te (Roediger & Karpicke, 2006). As horas aparecem, mas como contexto.

### Porque é que tenho de dizer a confiança antes de corrigir?

Porque depois de veres as respostas já não é uma previsão. A comparação entre o que esperavas e o que acertaste — a **calibração** — mostra onde a sensação de "já sei isto" te engana (Bjork, 1994), e essas disciplinas passam para o topo.

### Não sei nada de uma disciplina. Como mede o meu nível?

Não mede à partida — e bem. Sem testes, o domínio fica "por aprender". Nas primeiras semanas estudas matéria nova (é permitido fazê-lo em bloco). O primeiro **teste de controlo** mede só a matéria **que já deste**, não a disciplina inteira.

### E se o professor não disponibilizar exames antigos?

Os exercícios chegam. O efeito vem de recuperares da memória sem consultar, não da origem das perguntas. Guarda alguns exercícios de cada ficha sem os resolver e usa-os nos testes de controlo, misturando tópicos.

### Posso usar IA para estudar?

Sim — depois de tentares. Um tutor que dá respostas aumenta o desempenho com ajuda e reduz o desempenho sem ajuda (Bastani et al.). Por isso a prática com IA é registada à parte, e a app avisa quando há dependência. A IA do Estudar só organiza o plano; nunca resolve exercícios.

### Porque é que a app não tem um banco de perguntas?

Ainda não — está no [roadmap](/roadmap). Um banco de itens exige conteúdo de qualidade por disciplina; itens errados gerados por IA fariam mais mal do que bem. A versão atual funciona com os teus exercícios em papel, que é como os exames costumam ser.

## Sobre o percurso e as notas

### A média não bate certo com a dos serviços académicos

A app usa a média ponderada por ECTS das UCs **aprovadas**, truncada a 2 casas. Confirma se todas as UCs aprovadas têm nota e ECTS, e se as creditações (CC) estão marcadas como aprovadas. Se o teu curso calcula de outra forma, abre uma issue.

### A minha UC tem avaliação distribuída com nota mínima

Cria uma linha por componente em **Provas e avaliações**, com o peso e a nota mínima. Se uma nota ficar abaixo do mínimo, a UC passa a "reprovada" nessa altura e a app pede a data do recurso.

### E o recurso e a época especial?

Acrescenta uma prova com a época **Recurso** ou **Especial**. Quando tiver nota, substitui o resultado da época normal. Enquanto não tiver, a data dela passa a ser a data de exame da UC no plano.

### Tenho equivalências (CC)

Marca o tipo **CC** e a nota. Contam para a média como aprovadas e servem de pré-requisito.

## Sobre a instalação

### Preciso de pagar alguma coisa?

Não, para uso pessoal: Supabase, Cloudflare Workers e Gemini têm níveis gratuitos suficientes. Com Claude ou OpenAI pagas os pedidos à IA (poucos por semana).

### Não recebo o email com o código

- Confirma a pasta de spam.
- Com o email incluído no Supabase, só membros da equipa do projeto recebem emails e há limites por hora. Para outras pessoas, configura um SMTP próprio.
- Confirma que o template do email tem <code v-pre>{{ .Token }}</code> (o botão **Configurar** faz isto sozinho).

### O login pede um domínio autorizado

Adiciona o endereço da app em **Authentication → URL Configuration → Redirect URLs** no Supabase. O botão **Configurar** faz isto para `localhost`; o endereço do Worker é acrescentado automaticamente ao publicar **se tiveres colado o token nessa mesma sessão** do `npm start` — senão, carrega em **Configurar** outra vez depois de publicar.

### Mudei o código e não vejo as alterações

O service worker vai sempre buscar a versão mais recente quando há rede e recarrega a página quando uma nova versão assume o controlo. Se ainda vires a antiga, recarrega uma vez.
