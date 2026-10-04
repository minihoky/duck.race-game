// Server messages are written in English and translated on the way out.

const PT = {
  "This race cannot be started.": "Esta corrida não pode ser iniciada.",
  "Upload a PNG image.": "Envie uma imagem PNG.",
  "Upload a PNG image up to 4096 pixels on a side.": "Envie uma imagem PNG de até 4096 pixels por lado.",
  "Use a PNG smaller than 1.5 MB.": "Use um PNG menor que 1,5 MB.",
  "Add one name per line.": "Adicione um nome por linha.",
  "Add at least two names.": "Adicione pelo menos dois nomes.",
  "An official race can include up to 200 names.": "Uma corrida oficial pode ter até 200 nomes.",
  "Each name can be at most 40 characters.": "Cada nome pode ter no máximo 40 caracteres.",
  "This account is restricted. Contact support.": "Esta conta está restrita. Fale com o suporte.",
  "This account is blocked. Contact support.": "Esta conta está bloqueada. Fale com o suporte.",
  "Mercado Pago is not configured.": "O Mercado Pago não está configurado.",
  "Mercado Pago could not be confirmed.": "Não foi possível confirmar com o Mercado Pago.",
  "The payment webhook signature is missing.": "A assinatura do webhook de pagamento está ausente.",
  "The payment webhook signature is invalid.": "A assinatura do webhook de pagamento é inválida.",
  "The request could not be read.": "Não foi possível ler a solicitação.",
  "That payment was not found.": "Pagamento não encontrado.",
  "This payment is confirmed by Mercado Pago.": "Este pagamento é confirmado pelo Mercado Pago.",
  "That payment status is not recognized.": "Status de pagamento não reconhecido.",
  "Too many attempts. Wait a few minutes and try again.": "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  "That result ID was not found.": "ID de resultado não encontrado.",
  "That sponsor image was not found.": "Imagem de patrocinador não encontrada.",
  "Sign in to continue.": "Entre para continuar.",
  "Administrator access is assigned with ADMIN_EMAILS.": "O acesso de administrador é definido em ADMIN_EMAILS.",
  "Choose a race length from the list.": "Escolha uma duração da lista.",
  "The race name can be at most 60 characters.": "O nome da corrida pode ter no máximo 60 caracteres.",
  "Choose up to 8 sponsor images.": "Escolha até 8 imagens de patrocinadores.",
  "The client seed can use up to 64 letters, numbers, - or _.": "A seed do cliente pode ter até 64 letras, números, - ou _.",
  "That race result was not found.": "Resultado da corrida não encontrado.",
  "Only the organizer can start this race.": "Somente o organizador pode iniciar esta corrida.",
  "An official race is already in progress.": "Já existe uma corrida oficial em andamento.",
  "The payment gateway is not configured.": "O gateway de pagamento não está configurado.",
  "Mercado Pago is not configured. Add MERCADOPAGO_ACCESS_TOKEN.": "O Mercado Pago não está configurado. Adicione MERCADOPAGO_ACCESS_TOKEN.",
  "Choose a credit package.": "Escolha um pacote de créditos.",
  "Mercado Pago could not start this checkout. Try again.": "O Mercado Pago não conseguiu iniciar este pagamento. Tente novamente.",
  "This payment is waiting for the payment gateway.": "Este pagamento aguarda o gateway de pagamento.",
  "That Mercado Pago payment could not be read.": "Não foi possível ler esse pagamento do Mercado Pago.",
  "That Mercado Pago payment does not match this checkout.": "Esse pagamento do Mercado Pago não corresponde a esta compra.",
  "Name this sponsor.": "Dê um nome a este patrocinador.",
  "You can keep up to 12 sponsor images.": "Você pode manter até 12 imagens de patrocinadores.",
  "This account is not an administrator.": "Esta conta não é de administrador.",
  "Not found.": "Não encontrado.",
  "That account was not found.": "Conta não encontrada.",
  "Choose a valid account status.": "Escolha um status de conta válido.",
  "You cannot change the status of your own account.": "Você não pode alterar o status da sua própria conta.",
  "Enter a whole number of credits from -1000 to 1000, other than zero.": "Informe um número inteiro de créditos entre -1000 e 1000, diferente de zero.",
  "Add a short note for this adjustment. It does not refund cash.": "Adicione uma observação para este ajuste. Ele não devolve dinheiro.",
  "The balance cannot go below zero.": "O saldo não pode ficar negativo.",
  "Give the package a name of up to 40 characters.": "Dê ao pacote um nome de até 40 caracteres.",
  "Credits must be a whole number from 1 to 10000.": "Os créditos devem ser um número inteiro de 1 a 10000.",
  "The price must be at least 1.00.": "O preço deve ser de pelo menos 1,00.",
  "That package was not found.": "Pacote não encontrado.",
  "An account with this email already exists.": "Já existe uma conta com este e-mail.",
  "This verification link is invalid or has expired.": "Este link de verificação é inválido ou expirou.",
  "Email or password is incorrect.": "E-mail ou senha incorretos.",
  "Verify your email before signing in.": "Confirme seu e-mail antes de entrar.",
  "This reset link is invalid or has expired.": "Este link de redefinição é inválido ou expirou.",
  "Mercado Pago webhook secret is not configured.": "O segredo do webhook do Mercado Pago não está configurado.",
  "Mercado Pago webhook signature is missing.": "A assinatura do webhook do Mercado Pago está ausente.",
  "Mercado Pago webhook signature expired.": "A assinatura do webhook do Mercado Pago expirou.",
  "Mercado Pago webhook signature is invalid.": "A assinatura do webhook do Mercado Pago é inválida.",
  "Email could not be sent. Add SMTP settings and try again.": "Não foi possível enviar o e-mail. Configure o SMTP e tente novamente.",
  "Email could not be sent. Try again in a moment.": "Não foi possível enviar o e-mail. Tente novamente em instantes.",
  "Email is not set up on this server yet. Contact support.": "O envio de e-mails ainda não está configurado neste servidor. Fale com o suporte.",
  "That upload is too large.": "Esse arquivo é grande demais.",
  "The request could not be completed.": "Não foi possível concluir a solicitação.",
  "Method not allowed.": "Método não permitido.",
  "Enter your name.": "Informe seu nome.",
  "Enter a valid email address.": "Informe um e-mail válido.",
  "Use 8 to 72 characters with at least one letter and one number.": "Use de 8 a 72 caracteres, com pelo menos uma letra e um número.",
  "You need 1 credit to start an official race. Credits stay on this platform and cannot be transferred or refunded for cash.":
    "Você precisa de 1 crédito para iniciar uma corrida oficial. Os créditos ficam na plataforma e não podem ser transferidos nem convertidos em dinheiro.",
};

export const SERVER_MESSAGES_PT = PT;

export function langOf(req) {
  const explicit = String(req.headers["x-lang"] || "").toLowerCase();
  if (explicit === "en" || explicit === "pt") return explicit;
  const accept = String(req.headers["accept-language"] || "").toLowerCase();
  return accept.startsWith("en") ? "en" : "pt";
}

export function translate(lang, message) {
  if (lang !== "pt" || typeof message !== "string") return message;
  return PT[message] || message;
}

export function siteName() {
  return String(process.env.SITE_NAME || "ZooRacing").trim() || "ZooRacing";
}

const MAIL = {
  en: {
    verifySubject: (site) => `Confirm your ${site} email`,
    verifyText: (site, name, link) => `Hi ${name},\n\nConfirm your email to finish creating your ${site} account:\n${link}\n\nThis link expires in 24 hours.\n`,
    resendText: (site, name, link) => `Hi ${name},\n\nConfirm your ${site} email:\n${link}\n\nThis link expires in 24 hours.\n`,
    resetSubject: (site) => `Reset your ${site} password`,
    resetText: (site, name, link) =>
      `Hi ${name},\n\nChoose a new ${site} password:\n${link}\n\nThis link expires in 1 hour. If you did not ask for a reset, you can ignore this email.\n`,
  },
  pt: {
    verifySubject: (site) => `Confirme seu e-mail no ${site}`,
    verifyText: (site, name, link) => `Olá, ${name}!\n\nConfirme seu e-mail para concluir o cadastro no ${site}:\n${link}\n\nEste link expira em 24 horas.\n`,
    resendText: (site, name, link) => `Olá, ${name}!\n\nConfirme seu e-mail no ${site}:\n${link}\n\nEste link expira em 24 horas.\n`,
    resetSubject: (site) => `Redefina sua senha do ${site}`,
    resetText: (site, name, link) =>
      `Olá, ${name}!\n\nEscolha uma nova senha para o ${site}:\n${link}\n\nEste link expira em 1 hora. Se você não pediu a redefinição, ignore este e-mail.\n`,
  },
};

export function mailText(lang, key, ...args) {
  const set = MAIL[lang] || MAIL.pt;
  return set[key](siteName(), ...args);
}
