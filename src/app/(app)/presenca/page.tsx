import { redirect } from 'next/navigation';

// A presença agora fica dentro de Recrutas.
export default function PresencaRedirect() {
  redirect('/encontristas/presenca');
}
