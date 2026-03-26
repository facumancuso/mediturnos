# **App Name**: MediTurnos

## Core Features:

- User Authentication and Roles: Secure authentication system with different roles (professional, admin, patient) using Firebase Auth.
- Appointment Scheduling: Allow patients to book appointments via WhatsApp and professionals to manage their schedules through a calendar interface.
- Automated WhatsApp Communication: Implement a chatbot to handle appointment requests, confirmations, and reminders via Twilio's WhatsApp API. The chatbot will use a tool to decide when to send notifications based on patient and professional preferences.
- Subscription Management: Manage monthly subscriptions for professionals using Stripe, including trial periods, payment reminders, and account suspension on failed payments.
- Public Directory: Create a public directory of professionals with search and filter functionalities, including individual profile pages with booking options.
- Admin Dashboard: Provide an admin dashboard for managing professionals, subscriptions, profiles, and handling support tickets.
- Integration with Google Calendar: Allow professionals to integrate their Google Calendar for automatic synchronization of appointments.

## Style Guidelines:

- Primary color: Light blue (#ADD8E6) to evoke a sense of trust and serenity.
- Background color: Off-white (#F8F8FF), a desaturated light blue, for a clean, professional look.
- Accent color: Soft teal (#70A1AF), analogous to light blue, used to highlight interactive elements.
- Body and headline font: 'Inter' for a modern, neutral, and readable experience. Inter is a grotesque-style sans-serif font.
- Use Lucide React icons for a consistent and clear visual language.
- Employ a responsive, mobile-first design using Tailwind CSS and shadcn/ui components for a seamless experience across devices.
- Incorporate subtle animations to enhance user interaction and provide feedback on actions.