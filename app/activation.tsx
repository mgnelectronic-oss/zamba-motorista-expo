import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppAuth } from '@/contexts/AppAuthContext';
import { useAppTheme } from '@/contexts/AppThemeContext';
import { createActivationStyles, type ActivationStyles } from '@/theme/screens/activationStyles';
import { isSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { driverService, type DriverDocUploadAsset } from '@/services/driverService';
import type { DriverDocType, DriverDocument, DriverProfile, VehicleCategory } from '@/types/driver';

/** Cores predefinidas (lista no modal, sem a opção «Outra»). */
const VEHICLE_PRESET_COLOR_NAMES = [
  'Branco',
  'Preto',
  'Prata',
  'Cinza',
  'Azul',
  'Vermelho',
  'Verde',
  'Bege',
  'Castanho',
  'Amarelo',
] as const;

/**
 * Chave de estado para cor escrita à mão (alinhado com o texto "Outra (escrever cor)" no modal).
 * Valores de `vehicle_color` na BD: texto da lista ou string livre (quando outra).
 */
const VEHICLE_COLOR_CUSTOM = 'Outro' as const;

const CATEGORIES: { value: VehicleCategory; label: string }[] = [
  { value: 'economico', label: 'Económico' },
  { value: 'conforto', label: 'Conforto' },
  { value: 'moto', label: 'Moto' },
  { value: 'txopela', label: 'Txopela' },
];

export default function ActivationScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createActivationStyles(colors), [colors]);

  const insets = useSafeAreaInsets();
  const safeTop = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  );

  const { session } = useAppAuth();
  const user = session?.user;
  const userId = user?.id;

  const [loading, setLoading] = useState(true);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  /** Valor escolhido na lista (`''` = não escolhido; `'Outro'` = cor manual). */
  const [vehicleColorChoice, setVehicleColorChoice] = useState('');
  const [vehicleColorOther, setVehicleColorOther] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleCategory, setVehicleCategory] = useState<VehicleCategory>('economico');
  const [documents, setDocuments] = useState<DriverDocument>({
    license: null,
    livrete: null,
    vehicle_front: null,
    vehicle_back: null,
    driver_selfie: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [colorModal, setColorModal] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<DriverDocType | null>(null);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadData = useCallback(async () => {
    if (!userId || !isSupabaseConfigured) {
      if (isMounted.current) setLoading(false);
      return;
    }
    const safetyTimeout = setTimeout(() => {
      if (isMounted.current) setLoading(false);
    }, 5000);
    try {
      setLoading(true);
      setError(null);

      const { data: fetchedProfile, error: profileErr } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileErr) throw new Error(`Erro ao carregar perfil: ${profileErr.message}`);

      if (fetchedProfile) {
        const p = fetchedProfile as DriverProfile;
        setProfile(p);
        setDriverId(p.id);
        setVehicleBrand(p.vehicle_brand || '');
        setVehicleModel(p.vehicle_model || '');
        const vc = (p.vehicle_color || '').trim();
        if (!vc) {
          setVehicleColorChoice('');
          setVehicleColorOther('');
        } else if ((VEHICLE_PRESET_COLOR_NAMES as readonly string[]).includes(vc)) {
          setVehicleColorChoice(vc);
          setVehicleColorOther('');
        } else {
          setVehicleColorChoice(VEHICLE_COLOR_CUSTOM);
          setVehicleColorOther(vc);
        }
        setVehiclePlate(p.plate || '');
        setVehicleCategory(p.vehicle_category || 'economico');

        const { data: docData, error: docsErr } = await supabase
          .from('driver_documents')
          .select('*')
          .eq('driver_id', p.id)
          .maybeSingle();

        if (!docsErr && docData) {
          const d = docData as Record<string, unknown>;
          setDocuments({
            license: d.license_path ? `${d.license_path}?t=${Date.now()}` : null,
            livrete: d.vehicle_registration_path ? `${d.vehicle_registration_path}?t=${Date.now()}` : null,
            vehicle_front: d.vehicle_front_path ? `${d.vehicle_front_path}?t=${Date.now()}` : null,
            vehicle_back: d.vehicle_rear_path ? `${d.vehicle_rear_path}?t=${Date.now()}` : null,
            driver_selfie: d.driver_photo_path ? `${d.driver_photo_path}?t=${Date.now()}` : null,
          });
        } else {
          const merged = await driverService.getDocuments(userId, p.id);
          if (merged) setDocuments(merged);
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao carregar dados.';
      if (isMounted.current) setError(msg);
    } finally {
      clearTimeout(safetyTimeout);
      if (isMounted.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const effectiveVehicleColor = useMemo(() => {
    if (!vehicleColorChoice) return '';
    if (vehicleColorChoice === VEHICLE_COLOR_CUSTOM) return vehicleColorOther.trim();
    return vehicleColorChoice;
  }, [vehicleColorChoice, vehicleColorOther]);

  const saveVehicleData = async () => {
    if (!userId) return;
    try {
      setSavingVehicle(true);
      setError(null);
      setSuccessMsg(null);

      const brand = vehicleBrand.trim();
      const model = vehicleModel.trim();
      const color = effectiveVehicleColor;
      const plate = vehiclePlate.trim().toUpperCase();
      const category = vehicleCategory;

      if (!brand) throw new Error('A marca do veículo é obrigatória.');
      if (!model) throw new Error('O modelo do veículo é obrigatório.');
      if (!vehicleColorChoice) throw new Error('Selecione a cor do veículo.');
      if (vehicleColorChoice === VEHICLE_COLOR_CUSTOM && !vehicleColorOther.trim()) {
        throw new Error('Digite a cor do veículo.');
      }
      if (!plate) throw new Error('A matrícula do veículo é obrigatória.');
      if (!category) throw new Error('A categoria do veículo é obrigatória.');

      const payload = {
        vehicle_brand: brand,
        vehicle_model: model,
        vehicle_color: color,
        plate,
        vehicle_category: category,
      };

      const { data: existingDriver, error: checkError } = await supabase
        .from('drivers')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (checkError) throw checkError;

      if (!existingDriver) {
        const { error: insertError } = await supabase.from('drivers').insert({
          user_id: userId,
          full_name: (user?.user_metadata as { full_name?: string })?.full_name || '',
          phone: (user?.user_metadata as { phone?: string })?.phone || '',
          approval_status: 'pending',
          account_status: 'incomplete',
          verification_status: 'pending_documents',
          is_online: false,
          is_busy: false,
        });
        if (insertError) throw insertError;
      }

      const { error: updateError } = await supabase.from('drivers').update(payload).eq('user_id', userId);
      if (updateError) throw updateError;

      await loadData();
      setSuccessMsg('Dados do veículo guardados com sucesso!');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao guardar dados do veículo.';
      setError(msg);
    } finally {
      setSavingVehicle(false);
    }
  };

  const handleSubmitVerification = async () => {
    if (!userId) return;
    try {
      setSubmitting(true);
      setError(null);
      await driverService.updateProfile(userId, { verification_status: 'pending_review' });
      setProfile((prev) => (prev ? { ...prev, verification_status: 'pending_review' } : null));
      setSuccessMsg('Documentos enviados para análise.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao enviar para verificação.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const isAllDocsUploaded = () =>
    !!(
      documents.license &&
      documents.livrete &&
      documents.vehicle_front &&
      documents.vehicle_back &&
      documents.driver_selfie
    );

  const status = profile?.verification_status || 'pending_documents';
  const locked = status === 'verified' || status === 'approved' || status === 'pending_review';

  const canSubmit =
    !!driverId &&
    !!vehicleBrand.trim() &&
    !!vehicleModel.trim() &&
    !!effectiveVehicleColor &&
    !!vehiclePlate.trim() &&
    isAllDocsUploaded() &&
    status !== 'pending_review' &&
    status !== 'verified' &&
    status !== 'approved';

  const pickAndUpload = async (type: DriverDocType) => {
    if (!userId || !driverId) {
      setError('Guarde primeiro os dados do veículo para associar os documentos.');
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permissão', 'Precisamos de acesso à galeria para carregar documentos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;

    const picked = result.assets[0];
    const asset: DriverDocUploadAsset = {
      uri: picked.uri,
      mimeType: picked.mimeType ?? null,
      fileName: picked.fileName ?? null,
    };

    setUploadingDoc(type);
    try {
      setError(null);
      const url = await driverService.uploadDriverDocumentFromUri(userId, driverId, type, asset);
      setDocuments((prev) => ({ ...prev, [type]: url }));
    } catch (e: unknown) {
      console.error('[activation] document upload', e);
      const msg =
        e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string'
          ? (e as { message: string }).message
          : e instanceof Error
            ? e.message
            : 'Erro no upload. Tente novamente.';
      setError(msg);
    } finally {
      setUploadingDoc(null);
    }
  };

  if (!session || !isSupabaseConfigured) {
    return (
      <SafeAreaView style={[styles.root, { paddingTop: safeTop }]} edges={['left', 'right']}>
        <View style={styles.center}>
          <Text style={styles.muted}>Sessão indisponível.</Text>
          <Pressable onPress={() => router.replace('/(auth)/login')} style={styles.linkBtn}>
            <Text style={styles.linkBtnText}>Ir para login</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && !profile && !error) {
    return (
      <SafeAreaView style={[styles.root, { paddingTop: safeTop }]} edges={['left', 'right']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>A carregar dados de ativação…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !profile && !driverId) {
    return (
      <SafeAreaView style={[styles.root, { paddingTop: safeTop }]} edges={['left', 'right']}>
        <View style={styles.center}>
          <Ionicons name="alert-circle" size={40} color="#DC2626" />
          <Text style={styles.errTitle}>Erro ao carregar</Text>
          <Text style={styles.muted}>{error}</Text>
          <Pressable style={styles.primaryBtn} onPress={() => loadData()}>
            <Text style={styles.primaryBtnText}>Tentar novamente</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const statusUi = (() => {
    switch (status) {
      case 'verified':
      case 'approved':
        return {
          box: styles.statusOk,
          icon: 'checkmark-circle' as const,
          iconC: '#15803D',
          title: 'Conta Aprovada',
          desc: 'A sua conta está ativa e pronta para receber viagens.',
        };
      case 'pending_review':
        return {
          box: styles.statusInfo,
          icon: 'time-outline' as const,
          iconC: '#2563EB',
          title: 'Em Análise',
          desc: 'Os seus documentos estão a ser analisados pela nossa equipa.',
        };
      case 'rejected':
        return {
          box: styles.statusErr,
          icon: 'close-circle' as const,
          iconC: '#DC2626',
          title: 'Conta Rejeitada',
          desc: profile?.rejection_reason || 'Por favor, corrija os dados e reenvie.',
        };
      default:
        return {
          box: styles.statusWarn,
          icon: 'alert-circle-outline' as const,
          iconC: '#C2410C',
          title: 'Conta Não Verificada',
          desc: 'Preencha os dados e carregue os documentos para ativar.',
        };
    }
  })();

  return (
    <SafeAreaView style={[styles.root, { paddingTop: safeTop }]} edges={['left', 'right']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Ativação da conta</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollInner, { paddingBottom: Math.max(insets.bottom, 20) + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={styles.bannerErr}>
            <Ionicons name="alert-circle" size={18} color="#B91C1C" />
            <Text style={styles.bannerErrText}>{error}</Text>
          </View>
        ) : null}
        {successMsg ? (
          <View style={styles.bannerOk}>
            <Ionicons name="checkmark-circle" size={18} color="#15803D" />
            <Text style={styles.bannerOkText}>{successMsg}</Text>
          </View>
        ) : null}

        <View style={[styles.statusCard, statusUi.box]}>
          <View style={styles.statusIconWrap}>
            <Ionicons name={statusUi.icon} size={26} color={statusUi.iconC} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>{statusUi.title}</Text>
            <Text style={styles.statusDesc}>{statusUi.desc}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.cardHeadIcon}>
              <Ionicons name="car-outline" size={20} color={colors.accent} />
            </View>
            <Text style={styles.cardTitle}>Dados do veículo</Text>
          </View>

          <Field styles={styles} label="Marca" value={vehicleBrand} onChangeText={setVehicleBrand} editable={!locked} />
          <Field styles={styles} label="Modelo" value={vehicleModel} onChangeText={setVehicleModel} editable={!locked} />
          <Text style={styles.label}>Cor do veículo</Text>
          <Pressable
            onPress={() => !locked && setColorModal(true)}
            style={[styles.inputLike, locked && styles.inputLocked]}
          >
            <Text
              style={
                vehicleColorChoice &&
                (vehicleColorChoice !== VEHICLE_COLOR_CUSTOM || vehicleColorOther.trim())
                  ? styles.inputText
                  : styles.inputPlaceholder
              }
            >
              {!vehicleColorChoice
                ? 'Selecione a cor'
                : vehicleColorChoice === VEHICLE_COLOR_CUSTOM
                  ? vehicleColorOther.trim() || 'Outra (escrever cor)'
                  : vehicleColorChoice}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#94A3B8" />
          </Pressable>

          {vehicleColorChoice === VEHICLE_COLOR_CUSTOM && !locked ? (
            <View style={{ marginBottom: 12 }}>
              <TextInput
                value={vehicleColorOther}
                onChangeText={setVehicleColorOther}
                placeholder="Escreva a cor do veículo"
                placeholderTextColor={colors.textMuted}
                editable={!locked}
                autoCapitalize="words"
                returnKeyType="done"
                blurOnSubmit
                style={styles.input}
              />
            </View>
          ) : null}

          <Field
            styles={styles}
            label="Matrícula"
            value={vehiclePlate}
            onChangeText={(t) => setVehiclePlate(t.toUpperCase())}
            editable={!locked}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Categoria</Text>
          <View style={styles.catRow}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.value}
                onPress={() => !locked && setVehicleCategory(c.value)}
                style={[
                  styles.catChip,
                  vehicleCategory === c.value && styles.catChipOn,
                  locked && { opacity: 0.6 },
                ]}
              >
                <Text style={[styles.catChipText, vehicleCategory === c.value && styles.catChipTextOn]}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {!locked ? (
            <Pressable
              onPress={saveVehicleData}
              disabled={savingVehicle}
              style={({ pressed }) => [styles.saveDark, pressed && { opacity: 0.92 }]}
            >
              {savingVehicle ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.saveDarkText}>Guardar dados do veículo</Text>
              )}
            </Pressable>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.cardHeadIcon}>
              <Ionicons name="document-text-outline" size={20} color={colors.accent} />
            </View>
            <Text style={styles.cardTitle}>Documentação obrigatória</Text>
          </View>
          <Text style={styles.cardHint}>Carregue fotos nítidas dos seus documentos.</Text>

          <DocLine
            styles={styles}
            accent={colors.accent}
            title="Carta de condução"
            url={documents.license}
            locked={locked}
            uploading={uploadingDoc === 'license'}
            onPick={() => pickAndUpload('license')}
          />
          <DocLine
            styles={styles}
            accent={colors.accent}
            title="Livrete do veículo"
            url={documents.livrete}
            locked={locked}
            uploading={uploadingDoc === 'livrete'}
            onPick={() => pickAndUpload('livrete')}
          />
          <DocLine
            styles={styles}
            accent={colors.accent}
            title="Fotografia frontal do veículo"
            url={documents.vehicle_front}
            locked={locked}
            uploading={uploadingDoc === 'vehicle_front'}
            onPick={() => pickAndUpload('vehicle_front')}
          />
          <DocLine
            styles={styles}
            accent={colors.accent}
            title="Fotografia traseira do veículo"
            url={documents.vehicle_back}
            locked={locked}
            uploading={uploadingDoc === 'vehicle_back'}
            onPick={() => pickAndUpload('vehicle_back')}
          />
          <DocLine
            styles={styles}
            accent={colors.accent}
            title="Fotografia do motorista"
            url={documents.driver_selfie}
            locked={locked}
            uploading={uploadingDoc === 'driver_selfie'}
            onPick={() => pickAndUpload('driver_selfie')}
          />
        </View>

        <Pressable
          onPress={handleSubmitVerification}
          disabled={!canSubmit || submitting}
          style={[styles.submitBtn, (!canSubmit || submitting) && styles.submitBtnOff]}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={20} color={canSubmit ? '#FFF' : colors.textMuted} />
              <Text style={[styles.submitText, (!canSubmit || submitting) && styles.submitTextOff]}>
                Enviar para verificação
              </Text>
            </>
          )}
        </Pressable>

        {!canSubmit && status !== 'pending_review' && status !== 'verified' && status !== 'approved' ? (
          <Text style={styles.hintCenter}>
            Preencha os dados do veículo e carregue todos os documentos para enviar.
          </Text>
        ) : null}
      </ScrollView>

      <Modal visible={colorModal} transparent animationType="fade" onRequestClose={() => setColorModal(false)}>
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setColorModal(false)}
            accessibilityLabel="Fechar"
          />
          <SafeAreaView
            style={styles.modalSheetSafe}
            edges={['left', 'right', 'bottom']}
            pointerEvents="box-none"
          >
            <View style={styles.modalSheetOuter}>
              <View style={styles.modalList}>
                <Text style={styles.modalListTitle}>Cor do veículo</Text>
                <ScrollView
                  style={styles.modalScroll}
                  contentContainerStyle={styles.modalScrollInner}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator
                  bounces
                >
                  <Pressable
                    key="__outra__"
                    style={styles.modalItem}
                    onPress={() => {
                      setVehicleColorChoice(VEHICLE_COLOR_CUSTOM);
                      setColorModal(false);
                    }}
                  >
                    <Text style={styles.modalItemText}>Outra (escrever cor)</Text>
                  </Pressable>
                  {VEHICLE_PRESET_COLOR_NAMES.map((c) => (
                    <Pressable
                      key={c}
                      style={styles.modalItem}
                      onPress={() => {
                        setVehicleColorChoice(c);
                        setVehicleColorOther('');
                        setColorModal(false);
                      }}
                    >
                      <Text style={styles.modalItemText}>{c}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Field({
  styles,
  label,
  value,
  onChangeText,
  editable,
  autoCapitalize,
}: {
  styles: ActivationStyles;
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  editable: boolean;
  autoCapitalize?: 'characters' | 'none' | 'sentences' | 'words';
}) {
  const { colors } = useAppTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        autoCapitalize={autoCapitalize}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, !editable && styles.inputLocked]}
      />
    </View>
  );
}

function DocLine({
  styles,
  accent,
  title,
  url,
  locked,
  uploading,
  onPick,
}: {
  styles: ActivationStyles;
  accent: string;
  title: string;
  url: string | null;
  locked: boolean;
  uploading: boolean;
  onPick: () => void;
}) {
  const { colors } = useAppTheme();
  const ok = !!url;
  const disabled = locked || uploading;
  return (
    <View style={[styles.docRow, ok && styles.docRowOk]}>
      <View style={styles.docRowTop}>
        <Ionicons name="document-outline" size={22} color={ok ? accent : colors.textMuted} />
        <View style={{ flex: 1 }}>
          <Text style={styles.docTitle}>{title}</Text>
          <Text style={styles.docStatus}>
            {uploading ? 'A enviar…' : ok ? 'Carregado com sucesso' : 'Por carregar'}
          </Text>
        </View>
        <Pressable onPress={onPick} disabled={disabled} style={[styles.alterBtn, disabled && { opacity: 0.5 }]}>
          {uploading ? (
            <ActivityIndicator size="small" color={accent} />
          ) : (
            <Text style={styles.alterBtnText}>{ok ? 'Alterar' : 'Carregar'}</Text>
          )}
        </Pressable>
      </View>
      {url ? (
        <Image source={{ uri: url }} style={styles.docPreview} contentFit="cover" />
      ) : null}
    </View>
  );
}
