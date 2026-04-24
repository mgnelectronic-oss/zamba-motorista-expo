import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/contexts/AppThemeContext';
import { driverService } from '@/services/driverService';

export type TopupModalProps = {
  visible: boolean;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
};

/** Formulário de recarga — lógica alinhada a `Wallet.tsx` (web) / `createTopup` + RPC `request_wallet_topup`. */
export function TopupModal({ visible, userId, onClose, onSuccess }: TopupModalProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [method, setMethod] = useState<'mpesa' | 'emola'>('mpesa');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [observation, setObservation] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const reset = () => {
    setAmount('');
    setReference('');
    setObservation('');
    setMethod('mpesa');
  };

  const handleClose = () => {
    if (!isProcessing) {
      reset();
      onClose();
    }
  };

  const submit = async () => {
    const val = parseFloat(amount.replace(',', '.'));
    if (Number.isNaN(val) || val <= 0) {
      Alert.alert('Valor inválido', 'Informe o valor da recarga.');
      return;
    }

    setIsProcessing(true);
    try {
      await driverService.createTopup(userId, method, val, reference.trim() || undefined, observation.trim() || undefined);
      reset();
      onClose();
      onSuccess();
      Alert.alert('Pedido enviado', 'Aguarde a aprovação do administrador.');
    } catch {
      Alert.alert('Erro', 'Não foi possível enviar o pedido. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const phoneHint = method === 'mpesa' ? '844065856' : '874065856';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={handleClose} />
        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: colors.modalBg }]}
        >
          <View style={styles.grabber} />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.headRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Recarregar Conta</Text>
                <Text style={[styles.modalSub, { color: colors.textMuted }]}>Escolha o método e o valor</Text>
              </View>
              <Pressable onPress={handleClose} style={styles.closeRound} accessibilityLabel="Fechar">
                <Ionicons name="close" size={24} color="#64748B" />
              </Pressable>
            </View>

            <Text style={styles.label}>Método de pagamento</Text>
            <View style={styles.methodRow}>
              <Pressable
                onPress={() => setMethod('mpesa')}
                style={[
                  styles.methodCard,
                  method === 'mpesa' && styles.methodCardOn,
                  method === 'mpesa' && { borderColor: colors.accent, backgroundColor: colors.accentMuted },
                ]}
              >
                <Text style={styles.methodLetter}>M</Text>
                <Text style={styles.methodName}>M-Pesa</Text>
                {method === 'mpesa' ? <Ionicons name="checkmark-circle" size={20} color={colors.accent} /> : null}
              </Pressable>
              <Pressable
                onPress={() => setMethod('emola')}
                style={[
                  styles.methodCard,
                  method === 'emola' && styles.methodCardOn,
                  method === 'emola' && { borderColor: colors.accent, backgroundColor: colors.accentMuted },
                ]}
              >
                <Text style={styles.methodLetter}>e</Text>
                <Text style={styles.methodName}>eMola</Text>
                {method === 'emola' ? <Ionicons name="checkmark-circle" size={20} color={colors.accent} /> : null}
              </Pressable>
            </View>

            <Text style={styles.label}>Valor da recarga (MZN)</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="Ex: 100"
              placeholderTextColor="#94A3B8"
              style={styles.input}
            />

            <Text style={styles.label}>Referência / código (opcional)</Text>
            <TextInput
              value={reference}
              onChangeText={setReference}
              placeholder="Ex: 0987654321"
              placeholderTextColor="#94A3B8"
              style={styles.input}
            />

            <Text style={styles.label}>Observação (opcional)</Text>
            <TextInput
              value={observation}
              onChangeText={setObservation}
              placeholder="Alguma informação adicional?"
              placeholderTextColor="#94A3B8"
              style={[styles.input, styles.textArea]}
              multiline
            />

            <View style={styles.instructions}>
              <Text style={styles.instructionsTitle}>Instruções de pagamento</Text>
              <Text style={styles.instructionsBody}>
                Faça a transferência para o número{' '}
                <Text style={styles.instructionsBold}>{phoneHint}</Text> e depois confirme o pedido.
              </Text>
            </View>

            <Pressable
              onPress={submit}
              disabled={isProcessing}
              style={({ pressed }) => [
                styles.confirmBtn,
                { backgroundColor: colors.accent },
                pressed && !isProcessing && { opacity: 0.92 },
              ]}
            >
              {isProcessing ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.confirmBtnText}>Confirmar pedido</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 12,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  modalSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  closeRound: {
    padding: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  methodRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  methodCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#F1F5F9',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
  },
  methodCardOn: {},
  methodLetter: {
    width: 40,
    height: 40,
    borderRadius: 12,
    overflow: 'hidden',
    textAlign: 'center',
    lineHeight: 40,
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
    backgroundColor: '#94A3B8',
  },
  methodName: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#475569',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 16,
    backgroundColor: '#F8FAFC',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  instructions: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 20,
  },
  instructionsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  instructionsBody: {
    fontSize: 13,
    color: '#1D4ED8',
    fontWeight: '500',
    lineHeight: 19,
  },
  instructionsBold: {
    fontWeight: '800',
    color: '#1E3A8A',
  },
  confirmBtn: {
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    marginBottom: 8,
  },
  confirmBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
