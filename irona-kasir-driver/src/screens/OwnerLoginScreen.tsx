import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BrandHeader from '@/components/BrandHeader';
import PrimaryButton from '@/components/PrimaryButton';
import TextField from '@/components/TextField';
import { colors } from '@/constants/colors';
import { signInOwner } from '@/services/auth';
import type { OwnerProfile } from '@/types/auth';

interface OwnerLoginScreenProps {
  onSignedIn: (owner: OwnerProfile) => void;
}

/** Layar pertama di perangkat baru: Owner login sekali untuk membuka aplikasi */
export default function OwnerLoginScreen({ onSignedIn }: OwnerLoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit() {
    if (!username.trim() || !password) {
      setErrorMessage('Username dan password wajib diisi.');
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      const owner = await signInOwner(username, password);
      onSignedIn(owner);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Gagal masuk. Coba lagi.');
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <BrandHeader
          title="Buka perangkat"
          subtitle="Masuk dengan akun Owner. Cukup sekali di perangkat ini."
        />

        <SafeAreaView edges={['bottom']} style={styles.body}>
          <Text style={styles.title}>Login Owner</Text>
          <Text style={styles.subtitle}>
            Gunakan username & password yang sama dengan Web Admin.
          </Text>

          <View style={styles.form}>
            <TextField
              label="Username"
              prefix="@"
              value={username}
              onChangeText={(text) => setUsername(text.toLowerCase())}
              placeholder="owner1"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              returnKeyType="next"
            />
            <TextField
              label="Password"
              secret
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              autoComplete="password"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <PrimaryButton title="Masuk" onPress={handleSubmit} loading={loading} />
          </View>
        </SafeAreaView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
  },
  body: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: colors.textMuted,
  },
  form: {
    marginTop: 24,
    gap: 16,
  },
  errorBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecdd3',
    backgroundColor: colors.dangerBg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
  },
});