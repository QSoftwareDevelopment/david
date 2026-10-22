import * as SecureStore from 'expo-secure-store';

/**
 * Session storage backed by the iOS Keychain and the Android Keystore.
 *
 * Supabase defaults to AsyncStorage, which is an unencrypted file on disk — fine for a
 * theme preference, wrong for a refresh token that grants access to a business account.
 *
 * SecureStore caps values at 2048 bytes. Supabase sessions are comfortably under that
 * today, but a session that ever exceeded it would be silently dropped and the user
 * would appear to be logged out at random, so oversize writes throw instead.
 */

const SECURE_STORE_VALUE_LIMIT = 2048;

export const secureStorageAdapter = {
  getItem(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  },

  setItem(key: string, value: string): Promise<void> {
    if (value.length > SECURE_STORE_VALUE_LIMIT) {
      return Promise.reject(
        new Error(
          `Session payload is ${value.length} bytes, over SecureStore's ` +
            `${SECURE_STORE_VALUE_LIMIT}-byte limit. Storing it would fail silently and ` +
            'log the user out unpredictably.',
        ),
      );
    }
    return SecureStore.setItemAsync(key, value);
  },

  removeItem(key: string): Promise<void> {
    return SecureStore.deleteItemAsync(key);
  },
};
