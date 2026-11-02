# Guia de implantação

Este guia leva a plataforma do código até o ar, com banco PostgreSQL, Mercado Pago e e-mail. Tempo estimado: 1 a 2 horas.

## 1. O que você precisa

- Conta no **Render** (https://render.com). Hospeda o servidor Node.
- Projeto no **Supabase** (https://supabase.com). Hospeda o banco PostgreSQL.
- Conta de vendedor no **Mercado Pago**, com acesso a "Suas integrações".
- Uma conta de e-mail com **SMTP**: Gmail com senha de app, Zoho, Brevo, Amazon SES etc.
- (Opcional) Um domínio próprio, por exemplo `www.seusite.com.br`.
- (Opcional) Netlify, se quiser hospedar o frontend separadamente.

## 2. Publicar no Render (recomendado)

1. Envie o código para um repositório GitHub ou GitLab.
2. No Render, clique em **New > Blueprint** e escolha o repositório. O arquivo `render.yaml` cria:
   - o serviço web `animal-race` (build `npm ci --include=dev && npm run build`, início `npm start`);
3. Preencha as variáveis marcadas como "sync: false":

| Variável | Valor |
| --- | --- |
| `DATABASE_URL` | No Supabase: **Connect > Session pooler** (porta 5432). Não use o host direto `db.<ref>.supabase.co`: ele é só IPv6 e o Render não alcança. Troque `[YOUR-PASSWORD]` pela senha do banco |
| `PUBLIC_APP_URL` | Endereço público do site, com https e sem barra no final. Ex.: `https://animal-race.onrender.com` ou `https://www.seusite.com.br` |
| `ADMIN_EMAILS` | E-mails dos administradores, separados por vírgula |
| `MERCADOPAGO_ACCESS_TOKEN` | Access Token de **produção** (começa com `APP_USR-`) |
| `MERCADOPAGO_WEBHOOK_SECRET` | Assinatura secreta do webhook (passo 4) |
| `VITE_SUPPORT_EMAIL` | E-mail de suporte exibido no site |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | Dados do servidor de e-mail (passo 5) |

4. Clique em **Apply**. No primeiro início, o servidor cria todas as tabelas sozinho (`server/db/schema.sql`).
5. Abra `https://SEU-ENDERECO/api/health`. A resposta deve ser `{"ok":true,"store":"postgres"}`.

> Use um plano pago do Render para o serviço web. No plano gratuito, o serviço "dorme" quando fica sem acesso, e a primeira visita demora.
>
> Rode **uma única instância** do serviço. Não ative escalonamento horizontal.

### Domínio próprio

No serviço do Render, abra **Settings > Custom Domains** e adicione o domínio. Depois crie o registro DNS indicado (CNAME). Em seguida, atualize `PUBLIC_APP_URL` para o novo domínio e faça um novo deploy.

## 3. (Opcional) Frontend no Netlify

1. No arquivo `netlify.toml`, troque `YOUR-RENDER-SERVICE` pelo endereço do serviço no Render.
2. No Netlify, crie o site a partir do repositório. Build: `npm run build`; pasta: `dist`.
3. No Netlify, configure as variáveis `VITE_SITE_NAME` e `VITE_SUPPORT_EMAIL`.
4. No Render, defina `SERVE_STATIC=false` e coloque em `PUBLIC_APP_URL` o domínio do Netlify.

O Netlify repassa `/api/*` para o Render. Assim o login funciona no mesmo domínio, sem problemas de cookie.

## 4. Mercado Pago

1. Acesse https://www.mercadopago.com.br/developers/panel/app e crie uma aplicação do tipo **Checkout Pro** (ou use uma existente).
2. Em **Credenciais de produção**, copie o **Access Token** para `MERCADOPAGO_ACCESS_TOKEN`.
3. Em **Webhooks > Configurar notificações**:
   - URL de produção: `https://SEU-ENDERECO/api/credits/webhook`
   - Eventos: marque **Pagamentos**.
   - Salve e copie a **assinatura secreta** para `MERCADOPAGO_WEBHOOK_SECRET`.
4. Confirme que `PAYMENT_GATEWAY=mercadopago` e `PAYMENT_CURRENCY=BRL`.

Como funciona:

- O cliente escolhe um pacote em **Créditos**, paga no Mercado Pago e volta ao site.
- Os créditos entram somente depois que o servidor consulta o pagamento no Mercado Pago e confere três coisas: a referência, o valor e a moeda.
- O mesmo pagamento nunca credita duas vezes. Notificações repetidas do Mercado Pago são ignoradas.

Testes antes de abrir ao público:

- Use as credenciais de **teste** (`TEST-...`) e os usuários de teste do Mercado Pago, ou faça uma compra real de valor baixo e estorne em seguida.
- O modo `PAYMENT_GATEWAY=demo` adiciona créditos sem cobrar. Ele serve **apenas para desenvolvimento**; nunca use em produção.

**Estornos:** faça o estorno no painel do Mercado Pago. Depois, no painel do administrador (**Usuários > Gerenciar > Ajustar créditos**), remova os créditos com um número negativo e uma observação. O ajuste fica no registro de auditoria.

## 5. E-mail (SMTP)

O site envia e-mails de confirmação de cadastro e de redefinição de senha.

Exemplo com Gmail:

1. Ative a verificação em duas etapas na conta Google.
2. Em https://myaccount.google.com/apppasswords, crie uma **senha de app**.
3. Configure:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=seuemail@gmail.com
   SMTP_PASS=senha-de-app-de-16-letras
   ```

O remetente padrão é `ZooRacing <SMTP_USER>`. Para mudar, defina `MAIL_FROM`.

Para grandes volumes, prefira um serviço transacional (Brevo, Amazon SES, Mailgun). Configure SPF e DKIM no domínio para os e-mails não caírem no spam.

## 6. Primeiro acesso de administrador

1. Cadastre-se no site com um dos e-mails de `ADMIN_EMAILS` e confirme o e-mail.
2. Entre. O menu passa a mostrar **Administrador** (`/admin`).
3. No painel:
   - **Pacotes:** confira nomes, quantidades e preços (padrão: 10 créditos por R$ 9,00, 25 por R$ 19,00 e 50 por R$ 29,00).
   - **Patrocinadores:** envie as logos da plataforma (PNG). Elas aparecem em todas as corridas oficiais.
   - **Usuários:** busque contas, restrinja ou bloqueie (com motivo) e ajuste créditos.
   - **Registro de auditoria:** mostra se a cadeia está íntegra.

## 7. Migrar dados de desenvolvimento (opcional)

Se você já usou o site com o arquivo JSON (`server/data/accounts.json`) e quer levar esses dados para o banco:

```bash
DATABASE_URL="postgresql://...pooler.supabase.com:5432/postgres" DATABASE_SSL=no-verify npm run db:import
```

O comando só roda em um banco vazio.

## 7b. Migrar do Render para o Supabase

1. Crie o projeto no Supabase e copie a string do **Session pooler**.
2. Pare o serviço no Render para ninguém gravar durante a cópia.
3. Exporte o banco do Render (use a *External Database URL*):
   ```bash
   pg_dump --no-owner --no-privileges -f render.sql "RENDER_EXTERNAL_URL"
   ```
4. Importe no Supabase, que deve estar vazio (não inicie o servidor antes):
   ```bash
   psql "SUPABASE_URL" -v ON_ERROR_STOP=1 -f render.sql
   ```
   O dump inclui o esquema, os gatilhos e os dados. Os gatilhos só bloqueiam UPDATE/DELETE, então o INSERT da restauração não é afetado.
5. Confira as contagens (`SELECT count(*)` em `users`, `ledger`, `races`, `audit_log`) nos dois bancos.
6. No Render, defina `DATABASE_URL` com a string do Supabase e `DATABASE_SSL=no-verify`, e faça o deploy. Na primeira partida o servidor aplica `schema.sql` (idempotente), que ativa o RLS nas tabelas.
7. Teste `/api/health` e mantenha o banco antigo por alguns dias antes de apagá-lo.

## 8. Backups

- No Supabase, os planos pagos fazem backups diários (**Database > Backups**). No plano gratuito, faça `pg_dump` periódico.
- As imagens dos patrocinadores ficam no próprio banco (tabela `sponsor_images`), então o backup do banco cobre tudo.

## 9. Verificação de imparcialidade

Cada corrida oficial tem a página pública `/verify/ID`, que pode ser compartilhada com os participantes. Ela mostra:

- o hash da semente secreta, o hash da lista de nomes e o hash dos parâmetros, todos publicados **antes** da largada;
- a semente do cliente, adicionada na largada;
- a semente do servidor, revelada depois da chegada;
- os horários exatos de criação, largada e chegada;
- a trilha de auditoria da corrida.

O próprio navegador refaz o cálculo e confirma o resultado. A página também traz um script Node para conferir fora do site.

Essa prova é técnica e é feita pela própria plataforma. Ela **não** substitui uma certificação externa. O banco de dados também impede, por gatilhos, alterar parâmetros, participantes ou resultado de uma corrida depois de gravados, e impede apagar registros de auditoria e de créditos.

Mantenha as credenciais do banco restritas: quem tem acesso direto ao banco consegue ler a semente antes da largada. O painel de administrador nunca mostra a semente antes do fim da corrida.

## 10. Checklist antes de lançar

- [ ] `/api/health` responde `"store":"postgres"`
- [ ] `PUBLIC_APP_URL` com https e o domínio final
- [ ] Cadastro: o e-mail de confirmação chega e o link abre o site certo
- [ ] Redefinição de senha funciona
- [ ] Compra real de valor baixo credita uma única vez; o estorno foi feito e os créditos ajustados
- [ ] O webhook aparece como entregue no painel do Mercado Pago
- [ ] Corrida oficial: iniciar consome 1 crédito; replay não consome; `/verify/ID` mostra "Resultado verificado" após a chegada
- [ ] Pacotes, preços e patrocinadores conferidos no painel
- [ ] Termos de Uso e Política de Privacidade revisados por um advogado (os textos são um modelo)
