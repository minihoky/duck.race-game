import { Link } from "react-router-dom";
import { siteName, supportEmail } from "../content/site";
import { useT } from "../lib/i18n";
import { usePageTitle } from "../lib/usePageTitle";

const UPDATED = { pt: "2 de outubro de 2026", en: "October 2, 2026" };

function sections(lang, site, email) {
  if (lang === "pt") {
    return [
      ["1. Sobre o serviço", [`O ${site} é uma plataforma para realizar sorteios em formato de corrida de animais animada. O organizador cadastra os nomes dos participantes, inicia a corrida e o resultado é definido no servidor antes da animação começar.`, "Ao usar o serviço, você concorda com estes Termos. Se não concordar, não use o serviço."]],
      ["2. Contas", ["Para criar corridas oficiais é necessário ter uma conta com e-mail confirmado. Você é responsável pela confidencialidade da sua senha e por toda atividade realizada na sua conta.", "Podemos restringir ou bloquear contas que violem estes Termos, que apresentem indícios de fraude ou por exigência legal. Contas restritas podem consultar o histórico, mas não podem comprar créditos nem iniciar corridas. Contas bloqueadas não podem entrar."]],
      ["3. Créditos e pagamentos", ["Montar uma corrida não consome crédito. Um crédito é consumido quando uma corrida oficial é iniciada. Rever (replay) uma corrida finalizada não consome outro crédito.", `Os créditos só podem ser usados dentro do ${site}. Não podem ser sacados, transferidos para outra conta nem convertidos em dinheiro.`, "Os pagamentos são processados pelo Mercado Pago (PIX, cartão ou boleto). Os créditos são adicionados somente depois que o Mercado Pago confirma o pagamento e o servidor valida essa confirmação. O histórico de compras e de uso fica disponível em Minha conta.", "Pedidos de reembolso de pacotes não utilizados seguem o Código de Defesa do Consumidor e devem ser feitos pelo e-mail de suporte."]],
      ["4. Uso do sorteio", ["O organizador é o único responsável pela promoção, pelos prêmios, pelo regulamento e pelo cumprimento da legislação aplicável (incluindo, quando exigido, autorização para distribuição gratuita de prêmios). A plataforma fornece a ferramenta de sorteio e os meios de verificação; não organiza nem garante prêmios.", "Não é permitido usar o serviço para jogos de azar, apostas ou qualquer atividade ilegal."]],
      ["5. Verificação do resultado", ["Cada corrida oficial publica, antes da largada, o hash da semente secreta do servidor, o hash da lista de nomes e o hash dos parâmetros da corrida. Depois da chegada, a semente é revelada e qualquer pessoa pode recalcular a ordem na página Verificar.", "Esse mecanismo comprova que o resultado não foi alterado depois de publicado o compromisso. Ele não é uma certificação externa ou auditoria de terceiros."]],
      ["6. Conteúdo enviado", ["Você declara ter direito de uso sobre os nomes e as imagens de patrocinadores que enviar. Podemos remover conteúdo ofensivo, ilegal ou que viole direitos de terceiros."]],
      ["7. Disponibilidade e responsabilidade", ["Trabalhamos para manter o serviço disponível, mas ele é fornecido no estado em que se encontra. Na extensão permitida pela lei, não respondemos por danos indiretos ou lucros cessantes decorrentes do uso ou da indisponibilidade do serviço."]],
      ["8. Alterações", ["Podemos atualizar estes Termos. A data da última atualização aparece no topo desta página. O uso contínuo do serviço após a atualização significa concordância com a nova versão."]],
      ["9. Lei aplicável", ["Estes Termos são regidos pelas leis da República Federativa do Brasil."]],
      ["10. Contato", [`Dúvidas sobre estes Termos: ${email}`]],
    ];
  }
  return [
    ["1. About the service", [`${site} is a platform for running prize draws as an animated animal race. The organizer enters the participants' names and starts the race; the result is decided on the server before the animation begins.`, "By using the service you agree to these Terms. If you do not agree, do not use the service."]],
    ["2. Accounts", ["Official races require an account with a confirmed email address. You are responsible for keeping your password confidential and for all activity in your account.", "We may restrict or block accounts that break these Terms, show signs of fraud, or when required by law. Restricted accounts can view their history but cannot buy credits or start races. Blocked accounts cannot sign in."]],
    ["3. Credits and payments", ["Setting up a race does not use a credit. One credit is used when an official race starts. Replaying a finished race does not use another credit.", `Credits can only be used on ${site}. They cannot be withdrawn, transferred to another account, or exchanged for cash.`, "Payments are processed by Mercado Pago (PIX, card or boleto). Credits are added only after Mercado Pago confirms the payment and the server validates that confirmation. Purchase and usage history is available under My account.", "Refund requests for unused packages follow Brazilian consumer law and should be sent to the support email."]],
    ["4. Use of the draw", ["The organizer is solely responsible for the promotion, the prizes, its rules, and compliance with applicable law (including any authorization required for free prize promotions). The platform provides the draw tool and the verification means; it does not organize or guarantee prizes.", "The service may not be used for gambling, betting, or any illegal activity."]],
    ["5. Result verification", ["Before the start, every official race publishes the hash of the server's secret seed, the hash of the list of names, and the hash of the race parameters. After the finish the seed is revealed and anyone can recompute the order on the Verify page.", "This proves the result was not changed after the commitment was published. It is not an external certification or third-party audit."]],
    ["6. Uploaded content", ["You confirm you have the right to use the names and sponsor images you upload. We may remove offensive or illegal content, or content that infringes the rights of others."]],
    ["7. Availability and liability", ["We work to keep the service available, but it is provided as is. To the extent permitted by law, we are not liable for indirect damages or lost profits arising from the use or unavailability of the service."]],
    ["8. Changes", ["We may update these Terms. The date of the last update appears at the top of this page. Continuing to use the service after an update means you accept the new version."]],
    ["9. Governing law", ["These Terms are governed by the laws of the Federative Republic of Brazil."]],
    ["10. Contact", [`Questions about these Terms: ${email}`]],
  ];
}

export default function Terms() {
  const { t, lang } = useT();
  usePageTitle(t("Terms of Service"));
  return (
    <Legal
      title={t("Terms of Service")}
      updated={UPDATED[lang] || UPDATED.en}
      sections={sections(lang, siteName, supportEmail)}
      footer={
        <p>
          {t("For how we handle your data, see the")}{" "}
          <Link className="text-sky-600 underline" to="/privacy">
            {t("Privacy Policy")}
          </Link>
          .
        </p>
      }
    />
  );
}

export function Legal({ title, updated, sections, footer }) {
  const { t } = useT();
  return (
    <article className="mx-auto max-w-3xl px-4 pb-12 pt-20">
      <h1 className="mb-2 text-4xl font-bold">{title}</h1>
      <p className="mb-8 text-sm text-gray-500">{t("Last updated: {date}", { date: updated })}</p>
      <div className="space-y-8">
        {sections.map(([heading, ...blocks]) => (
          <section key={heading}>
            <h2 className="mb-3 text-2xl font-bold">{heading}</h2>
            {blocks.map((block, index) => (
              <div key={index}>
                {block.map((text) => (
                  <p key={text} className="mb-3 leading-relaxed text-gray-700">
                    {text}
                  </p>
                ))}
              </div>
            ))}
          </section>
        ))}
      </div>
      {footer && <div className="mt-8 text-gray-700">{footer}</div>}
    </article>
  );
}
