package twin

import (
	"bytes"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestGenerateKey_Length(t *testing.T) {
	key, err := GenerateKey()
	if err != nil {
		t.Fatalf("GenerateKey: %v", err)
	}
	if len(key) != keySize {
		t.Fatalf("key length: got %d, want %d", len(key), keySize)
	}
}

func TestGenerateKey_Unique(t *testing.T) {
	a, _ := GenerateKey()
	b, _ := GenerateKey()
	if bytes.Equal(a, b) {
		t.Fatal("two generated keys should not be equal")
	}
}

func TestSaveAndLoadKey(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "test-key")

	key, err := GenerateKey()
	if err != nil {
		t.Fatalf("GenerateKey: %v", err)
	}

	if err := SaveKey(path, key); err != nil {
		t.Fatalf("SaveKey: %v", err)
	}

	// Verify file permissions are 0600.
	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("stat key file: %v", err)
	}
	if info.Mode().Perm() != 0600 {
		t.Fatalf("key file permissions: got %o, want 0600", info.Mode().Perm())
	}

	loaded, err := LoadKey(path)
	if err != nil {
		t.Fatalf("LoadKey: %v", err)
	}
	if !bytes.Equal(key, loaded) {
		t.Fatal("loaded key does not match saved key")
	}
}

func TestLoadKey_WrongLength(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "bad-key")
	os.WriteFile(path, []byte("tooshort"), 0600)

	_, err := LoadKey(path)
	if err == nil {
		t.Fatal("expected error for wrong key length")
	}
}

func TestEnsureKey_CreateAndReuse(t *testing.T) {
	// Point EnsureKey at a temp dir by monkey-patching via env-free helper.
	// We test the save/load cycle directly since EnsureKey uses UserHomeDir.
	dir := t.TempDir()
	path := filepath.Join(dir, ".orchestra", "twin-key")

	// First call: key does not exist → generate and save.
	key1, err := SaveLoadEnsureKey(path)
	if err != nil {
		t.Fatalf("first EnsureKey: %v", err)
	}
	if len(key1) != keySize {
		t.Fatalf("key length: %d", len(key1))
	}

	// Second call: key already exists → load and return same key.
	key2, err := SaveLoadEnsureKey(path)
	if err != nil {
		t.Fatalf("second EnsureKey: %v", err)
	}
	if !bytes.Equal(key1, key2) {
		t.Fatal("second call should return the same key as the first")
	}
}

// SaveLoadEnsureKey is a testable version of EnsureKey that accepts an explicit
// path instead of relying on UserHomeDir.
func SaveLoadEnsureKey(path string) ([]byte, error) {
	key, err := LoadKey(path)
	if err == nil {
		return key, nil
	}
	// os.ReadFile wraps the underlying error; use errors.Is for reliable detection.
	if !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}
	key, err = GenerateKey()
	if err != nil {
		return nil, err
	}
	if err := SaveKey(path, key); err != nil {
		return nil, err
	}
	return key, nil
}

func TestEncryptDecrypt_RoundTrip(t *testing.T) {
	key, _ := GenerateKey()
	plaintext := []byte("hello orchestra — private data 🔒")

	ciphertext, err := Encrypt(plaintext, key)
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}
	if bytes.Equal(ciphertext, plaintext) {
		t.Fatal("ciphertext should not equal plaintext")
	}

	recovered, err := Decrypt(ciphertext, key)
	if err != nil {
		t.Fatalf("Decrypt: %v", err)
	}
	if !bytes.Equal(recovered, plaintext) {
		t.Fatalf("round-trip mismatch: got %q, want %q", recovered, plaintext)
	}
}

func TestEncrypt_UniqueNonce(t *testing.T) {
	key, _ := GenerateKey()
	msg := []byte("same message")

	c1, _ := Encrypt(msg, key)
	c2, _ := Encrypt(msg, key)
	if bytes.Equal(c1, c2) {
		t.Fatal("two encryptions of the same plaintext should produce different ciphertexts (random nonce)")
	}
}

func TestDecrypt_WrongKey(t *testing.T) {
	key1, _ := GenerateKey()
	key2, _ := GenerateKey()

	ciphertext, _ := Encrypt([]byte("secret"), key1)
	_, err := Decrypt(ciphertext, key2)
	if err == nil {
		t.Fatal("decrypting with wrong key should return an error")
	}
}

func TestDecrypt_Truncated(t *testing.T) {
	key, _ := GenerateKey()
	_, err := Decrypt([]byte("short"), key)
	if err == nil {
		t.Fatal("decrypting truncated ciphertext should return an error")
	}
}
