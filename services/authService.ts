import { supabase } from '@/lib/supabase';

/**
 * Autenticação e preparação do motorista — alinhado a `Zamba-Motorista-/src/services/authService.ts`.
 */
export const authService = {
  async signUp(
    email: string,
    pass: string,
    fullName: string,
    phone: string,
    onStep?: (step: string) => void,
  ) {
    onStep?.('Criando conta no sistema de autenticação...');
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: {
          full_name: fullName,
          phone: phone,
        },
      },
    });

    if (error) throw error;

    if (data.user) {
      await this.ensureDriverSetup(data.user.id, fullName, phone, onStep);
    }

    return data;
  },

  async signIn(email: string, pass: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    if (error) throw error;
    if (data.user) {
      await this.ensureDriverSetup(data.user.id);
    }
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async ensureDriverSetup(userId: string, fullName?: string, phone?: string, onStep?: (step: string) => void) {
    try {
      onStep?.('Configurando perfil de motorista...');

      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          id: userId,
          role: 'driver',
          full_name: fullName || '',
          phone: phone || '',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );

      if (profileError) {
        /* não bloquear — igual ao web */
      }

      onStep?.('Finalizando registro de motorista...');

      const { error: driverError } = await supabase.from('drivers').upsert(
        {
          id: userId,
          user_id: userId,
          is_online: false,
        },
        { onConflict: 'id' },
      );

      if (driverError) {
        /* não bloquear */
      }
    } catch {
      /* silencioso */
    }
  },
};
