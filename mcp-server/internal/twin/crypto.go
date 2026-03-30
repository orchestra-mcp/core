package twin

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

const keySize = 32 // AES-256

// GenerateKey creates a new random AES-256-GCM key.
func GenerateKey() ([]byte, error) {
	key := make([]byte, keySize)
	if _, err := io.ReadFull(rand.Reader, key); err != nil {
		return nil, fmt.Errorf("generate key: %w", err)
	}
	return key, nil
}

// SaveKey writes a raw key to path, creating parent directories as needed.
// Permissions are set to 0600 so only the owner can read the file.
func SaveKey(path string, key []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return fmt.Errorf("create key dir: %w", err)
	}
	if err := os.WriteFile(path, key, 0600); err != nil {
		return fmt.Errorf("write key: %w", err)
	}
	return nil
}

// LoadKey reads a raw key from path.
func LoadKey(path string) ([]byte, error) {
	key, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read key: %w", err)
	}
	if len(key) != keySize {
		return nil, fmt.Errorf("invalid key length: got %d, want %d", len(key), keySize)
	}
	return key, nil
}

// DefaultKeyPath returns ~/.orchestra/twin-key.
func DefaultKeyPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("home dir: %w", err)
	}
	return filepath.Join(home, ".orchestra", "twin-key"), nil
}

// EnsureKey loads the key from the default path. If the file does not exist a
// new key is generated and saved there. The key NEVER leaves the local machine.
func EnsureKey() ([]byte, error) {
	path, err := DefaultKeyPath()
	if err != nil {
		return nil, err
	}

	key, err := LoadKey(path)
	if err == nil {
		return key, nil
	}

	if !os.IsNotExist(err) {
		return nil, fmt.Errorf("load key: %w", err)
	}

	// Key file does not exist — generate and persist a new one.
	key, err = GenerateKey()
	if err != nil {
		return nil, err
	}
	if err := SaveKey(path, key); err != nil {
		return nil, err
	}
	return key, nil
}

// Encrypt encrypts data with AES-256-GCM using the provided 32-byte key.
// The returned ciphertext has the 12-byte nonce prepended:
//
//	[ nonce (12 bytes) | ciphertext + tag ]
func Encrypt(data []byte, key []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("new cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("new gcm: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("generate nonce: %w", err)
	}

	ciphertext := gcm.Seal(nonce, nonce, data, nil)
	return ciphertext, nil
}

// Decrypt decrypts AES-256-GCM ciphertext produced by Encrypt.
// It expects the 12-byte nonce to be prepended to the ciphertext.
func Decrypt(ciphertext []byte, key []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("new cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("new gcm: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, fmt.Errorf("ciphertext too short")
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("decrypt: %w", err)
	}
	return plaintext, nil
}
