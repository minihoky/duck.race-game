import { Link } from "react-router-dom";
import { siteName, supportEmail } from "../content/site";
import { useT } from "../lib/i18n";
import { usePageTitle } from "../lib/usePageTitle";
import { Legal } from "./Terms";

const UPDATED = { pt: "2 de outubro de 2026", en: "October 2, 2026" };

function sections(lang, site, email) {
  if (lang === "pt") {
    return [
      ["1. Quem somos", [`Esta Política explica como o ${site} trata dados pessoais, de acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018 – LGPD).`]],
      ["2. Dados que coletamos", ["Dados de conta: nome, e-mail e senha (armazenada apenas como hash).", "Dados de uso: corridas criadas, nomes dos participantes informados pelo organizador, resultados, créditos e histórico de compras.", "Dados de pagamento: identificador e situação do pagamento no Mercado Pago. Não recebemos nem armazenamos dados de cartão.", "Dados técnicos: endereço IP e informações do navegador, usados para segurança e limite de tentativas.", "Imagens de patrocinadores enviadas pelo organizador."]],
      ["3. Para que usamos", ["Criar e manter sua conta e confirmar seu e-mail.", "Executar corridas oficiais, registrar resultados e permitir a verificação pública.", "Processar compras de créditos e manter o histórico contábil.", "Prevenir fraude e abuso e manter o registro de auditoria.", "Cumprir obrigações legais."]],
      ["4. Bases legais", ["Execução de contrato (prestação do serviço), cumprimento de obrigação legal (registros fiscais e contábeis) e legítimo interesse (segurança e prevenção a fraude)."]],
      ["5. Dados públicos", ["A página de verificação de uma corrida é pública para quem tiver o link e mostra o nome da corrida, os nomes dos participantes e o resultado. Não informe dados sensíveis nos nomes."]],
      ["6. Compartilhamento", ["Mercado Pago, para processar pagamentos.", "Provedores de hospedagem, banco de dados e envio de e-mail que operam o serviço.", "Autoridades, quando exigido por lei.", "Não vendemos dados pessoais."]],
      ["7. Cookies", ["Usamos um cookie de sessão estritamente necessário para manter você conectado. A preferência de idioma e de som fica salva no seu navegador. Não usamos cookies de publicidade."]],
      ["8. Retenção", ["Mantemos os dados enquanto a conta existir. Registros de corridas, pagamentos e auditoria são mantidos pelo prazo necessário para comprovar resultados e cumprir obrigações legais, mesmo após o encerramento da conta."]],
      ["9. Seus direitos", ["Você pode pedir confirmação de tratamento, acesso, correção, anonimização, portabilidade ou eliminação dos seus dados, e revogar consentimentos, escrevendo para o e-mail abaixo."]],
      ["10. Segurança", ["Usamos conexões criptografadas, senhas com hash, cookies protegidos e registro de auditoria encadeado. Nenhum sistema é totalmente seguro, mas trabalhamos para proteger seus dados."]],
      ["11. Contato", [`Encarregado de dados e dúvidas sobre privacidade: ${email}`]],
    ];
  }
  return [
    ["1. Who we are", [`This Policy explains how ${site} handles personal data under Brazil's General Data Protection Law (Law 13,709/2018 – LGPD).`]],
    ["2. Data we collect", ["Account data: name, email, and password (stored only as a hash).", "Usage data: races you create, participant names entered by the organizer, results, credits, and purchase history.", "Payment data: the Mercado Pago payment identifier and status. We do not receive or store card details.", "Technical data: IP address and browser information, used for security and rate limiting.", "Sponsor images uploaded by the organizer."]],
    ["3. How we use it", ["To create and maintain your account and confirm your email.", "To run official races, record results, and allow public verification.", "To process credit purchases and keep the credit ledger.", "To prevent fraud and abuse and keep the audit log.", "To meet legal obligations."]],
    ["4. Legal bases", ["Performance of contract (providing the service), legal obligation (tax and accounting records), and legitimate interest (security and fraud prevention)."]],
    ["5. Public data", ["A race's verification page is public to anyone with the link and shows the race name, the participants' names, and the result. Do not put sensitive data in names."]],
    ["6. Sharing", ["Mercado Pago, to process payments.", "Hosting, database, and email providers that operate the service.", "Authorities, when required by law.", "We do not sell personal data."]],
    ["7. Cookies", ["We use one strictly necessary session cookie to keep you signed in. Your language and sound preferences are saved in your browser. We do not use advertising cookies."]],
    ["8. Retention", ["We keep data while the account exists. Race, payment, and audit records are kept as long as needed to prove results and meet legal obligations, even after the account is closed."]],
    ["9. Your rights", ["You can ask for confirmation of processing, access, correction, anonymization, portability, or deletion of your data, and withdraw consent, by writing to the email below."]],
    ["10. Security", ["We use encrypted connections, hashed passwords, protected cookies, and a hash-chained audit log. No system is completely secure, but we work to protect your data."]],
    ["11. Contact", [`Data protection contact and privacy questions: ${email}`]],
  ];
}

export default function Privacy() {
  const { t, lang } = useT();
  usePageTitle(t("Privacy Policy"));
  return (
    <Legal
      title={t("Privacy Policy")}
      updated={UPDATED[lang] || UPDATED.en}
      sections={sections(lang, siteName, supportEmail)}
      footer={
        <p>
          {t("For the rules of use, see the")}{" "}
          <Link className="text-sky-600 underline" to="/terms">
            {t("Terms of Service")}
          </Link>
          .
        </p>
      }
    />
  );
}
