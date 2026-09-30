import { Link } from "react-router-dom";
import { usePageTitle } from "../lib/usePageTitle";

const sections = [
  ["1. Introduction", ["Welcome to Duck Race (\"we,\" \"our,\" or \"us\"). By accessing or using our website, mobile application, and services (collectively, the \"Services\"), you agree to be bound by these Terms of Service (\"Terms\"). Please read these Terms carefully before using our Services.", "By accessing or using our Services, you agree to these Terms. If you do not agree to these Terms, please do not use our Services."]],
  ["2. Eligibility", ["You must be at least 13 years old to use our Services. By using our Services, you represent and warrant that you meet the eligibility requirements. If you are under 18, you represent that you have your parent or guardian's permission to use the Services."]],
  ["3. User Accounts", ["To access certain features of our Services, you may need to create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.", "You are responsible for providing accurate and complete information when creating your account. You agree not to impersonate any person or entity or misrepresent your identity or affiliation with any person or entity."]],
  ["4. User Conduct", ["When using our Services, you agree not to:"], ["Violate any applicable laws or regulations", "Infringe upon the rights of others", "Use our Services for any illegal or unauthorized purpose", "Interfere with or disrupt the Services or servers or networks connected to the Services", "Attempt to gain unauthorized access to any portion of the Services", "Harass, abuse, or harm another person", "Transmit any viruses, worms, defects, Trojan horses, or other items of a destructive nature"]],
  ["5. Intellectual Property", ["All content, features, and functionality of our Services, including but not limited to text, graphics, logos, icons, images, audio clips, digital downloads, data compilations, and software, are the exclusive property of Duck Race or its licensors and are protected by copyright, trademark, and other intellectual property laws.", "You may not reproduce, distribute, modify, create derivative works of, publicly display, publicly perform, republish, download, store, or transmit any of the material on our Services without our prior written consent."]],
  ["6. Credits and Payments", ["Official races use credits. Organizers can purchase credit packages. Creating or setting up a race does not use a credit. One credit is deducted when an official race starts. Replaying a finished race does not use another credit.", "Credits are for use only inside Duck Race. They cannot be withdrawn, transferred to another account, or refunded for cash.", "Credit purchases are confirmed by Mercado Pago. Credits are added only after Mercado Pago confirms the payment and the server checks that confirmation.", "You can review credit purchases and race usage in your account history."]],
  ["7. Limitation of Liability", ["To the maximum extent permitted by law, Duck Race shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Services."]],
  ["8. Indemnification", ["You agree to defend, indemnify, and hold harmless Duck Race, its affiliates, licensors, and service providers, and its and their respective officers, directors, employees, contractors, agents, licensors, suppliers, successors, and assigns from and against any claims, liabilities, damages, judgments, awards, losses, costs, expenses, or fees (including reasonable attorneys' fees) arising out of or relating to your violation of these Terms or your use of the Services."]],
  ["9. Modifications to Terms", ["We reserve the right to modify these Terms at any time. If we make changes to these Terms, we will provide notice of such changes by updating the date at the top of these Terms. Your continued use of our Services following the posting of revised Terms means that you accept and agree to the changes."]],
  ["10. Termination", ["We may terminate or suspend your account and access to our Services immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach these Terms.", "Upon termination, your right to use the Services will immediately cease. If you wish to terminate your account, you may simply discontinue using the Services or delete your account through the account settings."]],
  ["11. Governing Law", ["These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which Duck Race is established, without regard to its conflict of law provisions."]],
  ["12. Contact Us", ["If you have any questions about these Terms, please contact us at:", "Email: duckracegame@gmail.com", "By using Duck Race, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service."]],
];

export default function Terms() {
  usePageTitle("Free Duck Race Game - Terms of Service");
  return <Legal title="Terms of Service" sections={sections} footer={<p>For information about how we collect, use, and share your data, please see our <Link className="text-sky-600 underline" to="/privacy">Privacy Policy</Link>.</p>} />;
}

export function Legal({ title, sections, footer }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-2 text-4xl font-bold">{title}</h1>
      <p className="mb-8 text-sm text-gray-500">Last Updated: September 29, 2026</p>
      <div className="space-y-8">
        {sections.map((section) => (
          <section key={section[0]}>
            <h2 className="mb-3 text-2xl font-bold">{section[0]}</h2>
            {section.slice(1).map((block, index) =>
              Array.isArray(block) ? (
                <ul key={index} className="list-disc space-y-1 pl-5 text-gray-700">
                  {block.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p key={index} className="mb-3 leading-relaxed text-gray-700">{block}</p>
              )
            )}
          </section>
        ))}
      </div>
      {footer && <div className="mt-8 text-gray-700">{footer}</div>}
    </article>
  );
}
