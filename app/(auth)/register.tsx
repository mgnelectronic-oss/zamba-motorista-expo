import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Redirect, router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { authService } from '@/services/authService';
import { isSupabaseConfigured } from '@/lib/env';
import { ZambaColors } from '@/constants/zambaColors';
import { useAppAuth } from '@/contexts/AppAuthContext';

/** Espelha `Zamba-Motorista-/src/pages/Signup.tsx` (sem Alert). */
export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { isLoadingApp, session } = useAppAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  const handleSubmit = async () => {
    if (!isSupabaseConfigured) {
      setError('Supabase não configurado. Verifique EXPO_PUBLIC_SUPABASE_* no .env.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMessage('');
    setCurrentStep('Iniciando cadastro...');

    try {
      const data = await authService.signUp(
        email.trim(),
        password,
        fullName.trim(),
        phone.trim(),
        (step) => setCurrentStep(step),
      );

      if (data.user && !data.session) {
        setSuccessMessage(
          'Conta criada com sucesso! Por favor, verifique seu e-mail para confirmar a conta antes de fazer login.',
        );
        setCurrentStep('Aguardando confirmação de e-mail...');
        redirectTimerRef.current = setTimeout(() => {
          router.replace('/(auth)/login');
        }, 5000);
      } else {
        setCurrentStep('Cadastro concluído! Redirecionando...');
        router.replace('/(tabs)');
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Erro ao criar conta. Verifique os dados e tente novamente.';
      setError(msg);
      setCurrentStep('');
    } finally {
      setLoading(false);
    }
  };

  if (isLoadingApp) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.boot}>
          <ActivityIndicator size="large" color={ZambaColors.green} />
        </View>
      </SafeAreaView>
    );
  }

  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.card}>
              <View style={styles.iconWrap}>
                <Ionicons name="car-sport" size={32} color="#FFF" />
              </View>
              <Text style={styles.title}>Criar Conta</Text>
              <Text style={styles.subtitle}>Junte-se à equipe de motoristas Zamba</Text>

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorTitle}>Falha no cadastro:</Text>
                  <Text style={styles.errorText}>{error}</Text>
                  <Text style={styles.errorHint}>
                    Dica: Verifique se o e-mail já está em uso ou se a senha tem pelo menos 6 caracteres.
                  </Text>
                </View>
              ) : null}

              {successMessage ? (
                <View style={styles.successBox}>
                  <Text style={styles.successTitle}>Sucesso!</Text>
                  <Text style={styles.successText}>{successMessage}</Text>
                </View>
              ) : null}

              {loading && currentStep ? (
                <View style={styles.stepBox}>
                  <ActivityIndicator size="small" color="#1D4ED8" />
                  <Text style={styles.stepText}>{currentStep}</Text>
                </View>
              ) : null}

              <Text style={styles.label}>Nome Completo</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Seu Nome"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="words"
                textContentType="name"
              />

              <Text style={styles.label}>Telefone</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+258..."
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
              />

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="seu@email.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
              />

              <Text style={styles.label}>Senha</Text>
              <View style={styles.passwordFieldWrap}>
                <TextInput
                  style={styles.inputWithSuffix}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!passwordVisible}
                  textContentType="newPassword"
                />
                <Pressable
                  onPress={() => setPasswordVisible((v) => !v)}
                  style={styles.suffixPress}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={passwordVisible ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  <Ionicons
                    name={passwordVisible ? 'eye-outline' : 'eye-off-outline'}
                    size={22}
                    color="#6B7280"
                  />
                </Pressable>
              </View>

              <Pressable
                onPress={handleSubmit}
                disabled={loading}
                style={({ pressed }) => [styles.primaryBtn, (pressed || loading) && styles.primaryBtnPressed]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Cadastrar</Text>
                )}
              </Pressable>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Já tem uma conta? </Text>
                <Pressable onPress={() => router.replace('/(auth)/login')}>
                  <Text style={styles.link}>Entrar</Text>
                </Pressable>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ZambaColors.bg },
  boot: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 160,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#F3F4F6',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },
  iconWrap: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ZambaColors.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorTitle: { fontSize: 13, color: '#DC2626', fontWeight: '700', marginBottom: 4 },
  errorText: { fontSize: 13, color: '#DC2626', fontWeight: '500' },
  errorHint: { fontSize: 11, color: '#DC2626', opacity: 0.7, marginTop: 8 },
  successBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  successTitle: { fontSize: 13, color: '#15803D', fontWeight: '700', marginBottom: 4 },
  successText: { fontSize: 13, color: '#15803D', fontWeight: '500' },
  stepBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  stepText: { flex: 1, fontSize: 13, color: '#1D4ED8', fontWeight: '500' },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 16,
    color: '#111827',
    marginBottom: 14,
    backgroundColor: '#FAFAFA',
  },
  passwordFieldWrap: {
    position: 'relative',
    marginBottom: 14,
  },
  inputWithSuffix: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingLeft: 14,
    paddingRight: 48,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#FAFAFA',
  },
  suffixPress: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: ZambaColors.green,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  primaryBtnPressed: { opacity: 0.88 },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: { fontSize: 14, color: '#6B7280' },
  link: { fontSize: 14, fontWeight: '600', color: ZambaColors.greenDark },
});
