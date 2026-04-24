import React, { useState } from 'react';
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

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { isLoadingApp, session } = useAppAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!isSupabaseConfigured) {
      setError('Supabase não configurado. Verifique EXPO_PUBLIC_SUPABASE_* no .env.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authService.signIn(email.trim(), password);
      router.replace('/(tabs)');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao fazer login';
      setError(msg);
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
              <Text style={styles.title}>Zamba Motorista</Text>
              <Text style={styles.subtitle}>Entre na sua conta para começar a dirigir</Text>

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

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
                  placeholder="••••••••"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!passwordVisible}
                  textContentType="password"
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
                  <Text style={styles.primaryBtnText}>Entrar</Text>
                )}
              </Pressable>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Não tem uma conta? </Text>
                <Pressable onPress={() => router.push('./register')}>
                  <Text style={styles.link}>Cadastre-se</Text>
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
  errorText: { fontSize: 13, color: '#DC2626', fontWeight: '500' },
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
