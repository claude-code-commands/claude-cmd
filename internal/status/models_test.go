package status

import (
	"testing"
	"time"
)

func TestCacheStatus_Validate(t *testing.T) {
	tests := []struct {
		name    string
		status  CacheStatus
		wantErr bool
	}{
		{
			name: "valid cache status",
			status: CacheStatus{
				CommandCount: 15,
				LastUpdated:  time.Now(),
				Language:     "en",
			},
			wantErr: false,
		},
		{
			name: "zero command count is valid (empty cache)",
			status: CacheStatus{
				CommandCount: 0,
				LastUpdated:  time.Now(),
				Language:     "en",
			},
			wantErr: false,
		},
		{
			name: "negative command count is invalid",
			status: CacheStatus{
				CommandCount: -1,
				LastUpdated:  time.Now(),
				Language:     "en",
			},
			wantErr: true,
		},
		{
			name: "empty language is invalid",
			status: CacheStatus{
				CommandCount: 10,
				LastUpdated:  time.Now(),
				Language:     "",
			},
			wantErr: true,
		},
		{
			name: "zero time is invalid",
			status: CacheStatus{
				CommandCount: 10,
				LastUpdated:  time.Time{},
				Language:     "en",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.status.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("CacheStatus.Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestInstalledStatus_Validate(t *testing.T) {
	tests := []struct {
		name    string
		status  InstalledStatus
		wantErr bool
	}{
		{
			name: "valid installed status with personal directory",
			status: InstalledStatus{
				Count:           3,
				PrimaryLocation: "personal",
			},
			wantErr: false,
		},
		{
			name: "valid installed status with project directory",
			status: InstalledStatus{
				Count:           5,
				PrimaryLocation: "project",
			},
			wantErr: false,
		},
		{
			name: "zero count is valid (no installed commands)",
			status: InstalledStatus{
				Count:           0,
				PrimaryLocation: "personal",
			},
			wantErr: false,
		},
		{
			name: "negative count is invalid",
			status: InstalledStatus{
				Count:           -1,
				PrimaryLocation: "personal",
			},
			wantErr: true,
		},
		{
			name: "empty primary location is invalid",
			status: InstalledStatus{
				Count:           3,
				PrimaryLocation: "",
			},
			wantErr: true,
		},
		{
			name: "invalid primary location is invalid",
			status: InstalledStatus{
				Count:           3,
				PrimaryLocation: "invalid",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.status.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("InstalledStatus.Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestFullStatus_Validate(t *testing.T) {
	validCache := CacheStatus{
		CommandCount: 15,
		LastUpdated:  time.Now(),
		Language:     "en",
	}
	validInstalled := InstalledStatus{
		Count:           3,
		PrimaryLocation: "personal",
	}

	tests := []struct {
		name    string
		status  FullStatus
		wantErr bool
	}{
		{
			name: "valid full status",
			status: FullStatus{
				Version:   "v1.0.0",
				Cache:     validCache,
				Installed: validInstalled,
			},
			wantErr: false,
		},
		{
			name: "dev version is valid",
			status: FullStatus{
				Version:   "dev",
				Cache:     validCache,
				Installed: validInstalled,
			},
			wantErr: false,
		},
		{
			name: "empty version is invalid",
			status: FullStatus{
				Version:   "",
				Cache:     validCache,
				Installed: validInstalled,
			},
			wantErr: true,
		},
		{
			name: "invalid cache status propagates error",
			status: FullStatus{
				Version: "v1.0.0",
				Cache: CacheStatus{
					CommandCount: -1, // invalid
					LastUpdated:  time.Now(),
					Language:     "en",
				},
				Installed: validInstalled,
			},
			wantErr: true,
		},
		{
			name: "invalid installed status propagates error",
			status: FullStatus{
				Version: "v1.0.0",
				Cache:   validCache,
				Installed: InstalledStatus{
					Count:           -1, // invalid
					PrimaryLocation: "personal",
				},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.status.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("FullStatus.Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestCacheStatus_Fields(t *testing.T) {
	// Test that CacheStatus has the expected fields and types
	lastUpdated := time.Now()
	status := CacheStatus{
		CommandCount: 42,
		LastUpdated:  lastUpdated,
		Language:     "fr",
	}

	if status.CommandCount != 42 {
		t.Errorf("CommandCount = %d, expected 42", status.CommandCount)
	}
	if status.LastUpdated != lastUpdated {
		t.Errorf("LastUpdated = %v, expected %v", status.LastUpdated, lastUpdated)
	}
	if status.Language != "fr" {
		t.Errorf("Language = %q, expected %q", status.Language, "fr")
	}
}

func TestInstalledStatus_Fields(t *testing.T) {
	// Test that InstalledStatus has the expected fields and types
	status := InstalledStatus{
		Count:           7,
		PrimaryLocation: "project",
	}

	if status.Count != 7 {
		t.Errorf("Count = %d, expected 7", status.Count)
	}
	if status.PrimaryLocation != "project" {
		t.Errorf("PrimaryLocation = %q, expected %q", status.PrimaryLocation, "project")
	}
}

func TestFullStatus_Fields(t *testing.T) {
	// Test that FullStatus has the expected fields and types
	cache := CacheStatus{CommandCount: 10, LastUpdated: time.Now(), Language: "en"}
	installed := InstalledStatus{Count: 5, PrimaryLocation: "personal"}

	status := FullStatus{
		Version:   "v2.1.0",
		Cache:     cache,
		Installed: installed,
	}

	if status.Version != "v2.1.0" {
		t.Errorf("Version = %q, expected %q", status.Version, "v2.1.0")
	}
	if status.Cache.CommandCount != 10 {
		t.Errorf("Cache.CommandCount = %d, expected 10", status.Cache.CommandCount)
	}
	if status.Installed.Count != 5 {
		t.Errorf("Installed.Count = %d, expected 5", status.Installed.Count)
	}
}
