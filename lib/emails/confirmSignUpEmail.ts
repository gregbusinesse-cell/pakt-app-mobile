// lib/emails/confirmSignUpEmail.ts
// Confirmation email template for signup

import { emailLayout, ctaButton, heading, paragraph } from './layout'

export function confirmSignUpEmail(firstName: string, confirmationUrl: string): { subject: string; html: string } {
  const name = firstName?.trim() || ''
  const greeting = name ? `Bienvenue ${name} !` : 'Bienvenue !'

  return {
    subject: 'Confirme ton adresse email pour PAKT',
    html: emailLayout(`
      ${heading(greeting)}
      ${paragraph('Tu es à un clic de rejoindre la communauté francophone avec le plus d\'opportunités.')}
      ${paragraph('Clique le bouton ci-dessous pour confirmer ton adresse email et activer ton compte.')}
      ${ctaButton('Confirmer mon compte', confirmationUrl)}
      ${paragraph('<em style="color:rgba(255,255,255,0.4);font-size:12px;">Si tu n\'es pas à l\'origine de cette demande, ignore cet email.</em>')}
    `),
  }
}
