import { FC } from 'react';
import { PageMeta } from '@/components/PageMeta';
import { LoginForm } from '@/components/auth/LoginForm';

export const LoginPage: FC = () => {
  return (
    <>
      <PageMeta titleKey="auth.login" descriptionKey="meta.login" path="/login" />
      <LoginForm />
    </>
  );
};
