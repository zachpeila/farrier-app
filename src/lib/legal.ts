/**
 * Privacy policy and terms of use, shown in the app and on the web at
 * /legal/privacy and /legal/terms (the app stores need a public link).
 *
 * DRAFT: written for the app as built. Have it reviewed before launch.
 */

export const OPERATOR = 'Caprock Resources LLC';
export const CONTACT_EMAIL = 'zachpeila@gmail.com';
export const UPDATED = 'November 3, 2026';

type Section = { heading: string; body: string[] };
export type LegalDoc = { title: string; sections: Section[] };

export const PRIVACY: LegalDoc = {
  title: 'Privacy policy',
  sections: [
    {
      heading: 'Who we are',
      body: [
        `${OPERATOR} ("we") runs the Farrier App, which helps farriers and horse owners keep shoeing schedules, records and invoices in one place. This policy explains what we collect, why, and the choices you have. It applies in the United States and Canada.`,
      ],
    },
    {
      heading: 'What we collect',
      body: [
        'Account details: your email address, name, phone number, business name, country and state or province.',
        'Horse and barn records: horse names and details, barn names and addresses, map pins for barns, shoeing intervals, visit records, notes and photos.',
        'Clients: farriers can add the names, phone numbers and emails of the owners they work for.',
        'Scheduling and billing: visits, visit requests, invoices and payment records. Card payments are handled by Stripe; we never see or store full card numbers.',
        'Device details: a push notification token so we can send reminders, and your time zone.',
        'Location: only when you choose "Pin where I am now" on a barn. We do not track your location in the background.',
      ],
    },
    {
      heading: 'How we use it',
      body: [
        'To run the app: show your schedule, due list, records and invoices, and send the reminders you rely on.',
        'To connect farriers and owners you choose to share with. A farrier sees the horses they work on. An owner sees their own horses and the visits their farrier shares.',
        'To take card payments through Stripe and pay farriers.',
        'To keep the service secure and fix problems.',
        'We do not sell your personal information and we do not use it for advertising.',
      ],
    },
    {
      heading: 'Who we share it with',
      body: [
        'People you connect with in the app, as described above.',
        'Service providers that run parts of the app for us: Supabase (database and file storage), Stripe (card payments), Expo (push notifications) and Vercel (website hosting). They may only use your information to provide their service to us.',
        'Authorities, when the law requires it.',
      ],
    },
    {
      heading: 'Where it is stored',
      body: ['Your data is stored in Canada (Supabase, Canada Central region). Our service providers may process it in the United States.'],
    },
    {
      heading: 'How long we keep it',
      body: [
        'We keep your information while your account is open. When you delete your account, we delete your data, except where the law requires us to keep records (for example payment records that Stripe keeps).',
      ],
    },
    {
      heading: 'Your choices and rights',
      body: [
        'You can see and correct your information in the app at any time.',
        'You can delete your account and data in the app under Account > Delete my account.',
        'You can turn off notifications in your phone settings.',
        `You can ask us for a copy of your information, or ask questions about privacy, at ${CONTACT_EMAIL}. Depending on where you live (for example Canada, California or another US state with a privacy law), you may have further rights, and we will honor them.`,
      ],
    },
    {
      heading: 'Children',
      body: ['The app is not meant for children under 13, and we do not knowingly collect their information.'],
    },
    {
      heading: 'Changes',
      body: ['If we change this policy, we will update the date below and tell you in the app if the change is significant.'],
    },
  ],
};

export const TERMS: LegalDoc = {
  title: 'Terms of use',
  sections: [
    {
      heading: 'Using the app',
      body: [
        `These terms are an agreement between you and ${OPERATOR}. By using the Farrier App you agree to them. You must be at least 18, or have a parent's permission, to use it.`,
        'Keep your sign-in email secure. You are responsible for what happens in your account.',
      ],
    },
    {
      heading: 'Your content',
      body: [
        'You own the records, notes and photos you add. You give us permission to store them and show them to the people you share them with, only so we can run the app.',
        'Only add information you have the right to share, including your clients’ contact details.',
      ],
    },
    {
      heading: 'Farriers and owners',
      body: [
        'Farriers are independent businesses. We do not employ farriers, and we are not responsible for their work, prices or advice. Agreements about work and payment are between the farrier and the owner.',
        'The app is a record-keeping and scheduling tool. It is not veterinary advice.',
      ],
    },
    {
      heading: 'Payments',
      body: [
        'Card payments are processed by Stripe and are subject to the Stripe Services Agreement. Farriers who accept cards agree to Stripe’s Connected Account Agreement. Refunds and disputes are between the farrier and the owner, handled through Stripe.',
      ],
    },
    {
      heading: 'Acceptable use',
      body: ['Do not misuse the app: no unlawful content, no harassment, no attempts to access other people’s data or to disrupt the service.'],
    },
    {
      heading: 'Availability and liability',
      body: [
        'We work to keep the app running and your data safe, but the app is provided "as is". To the extent the law allows, we are not liable for indirect losses, lost profits or lost data, and our total liability is limited to the amount you paid us in the 12 months before the claim.',
      ],
    },
    {
      heading: 'Ending your account',
      body: ['You can delete your account at any time. We may suspend accounts that break these terms.'],
    },
    {
      heading: 'Changes and contact',
      body: [`We may update these terms and will tell you in the app if the change is significant. Questions: ${CONTACT_EMAIL}.`],
    },
  ],
};
