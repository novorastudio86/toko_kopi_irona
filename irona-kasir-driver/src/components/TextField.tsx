import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors } from '@/constants/colors';

interface TextFieldProps extends TextInputProps {
  label: string;
  /** Teks kecil di depan isian, mis. "@" untuk username */
  prefix?: string;
  /** Isian rahasia (password/PIN) dengan tombol Lihat/Sembunyikan */
  secret?: boolean;
  errorText?: string | null;
}

/** Isian teks dengan label, sama gayanya dengan form Web Admin */
export default function TextField({
  label,
  prefix,
  secret = false,
  errorText,
  style,
  ...inputProps
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.box,
          focused && styles.boxFocused,
          !!errorText && styles.boxError,
        ]}
      >
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          {...inputProps}
          secureTextEntry={secret && hidden}
          placeholderTextColor={colors.textSubtle}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          style={[styles.input, style]}
        />
        {secret ? (
          <Pressable onPress={() => setHidden((v) => !v)} hitSlop={8}>
            <Text style={styles.toggle}>{hidden ? 'Lihat' : 'Sembunyikan'}</Text>
          </Pressable>
        ) : null}
      </View>
      {errorText ? <Text style={styles.error}>{errorText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  boxFocused: {
    borderColor: colors.primary,
  },
  boxError: {
    borderColor: colors.danger,
  },
  prefix: {
    fontSize: 15,
    color: colors.textSubtle,
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.text,
  },
  toggle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  error: {
    fontSize: 12,
    color: colors.danger,
  },
});