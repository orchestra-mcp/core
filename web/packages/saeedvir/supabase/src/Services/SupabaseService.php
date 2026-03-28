<?php

namespace Saeedvir\Supabase\Services;

class SupabaseService
{
    public DatabaseService $db;
    public AuthService $auth;
    public StorageService $storage;
    public RealtimeService $realtime;

    protected SupabaseClient $client;

    public function __construct()
    {
        $this->client = new SupabaseClient();
        
        if (config('supabase.services.database', true)) {
            $this->db = new DatabaseService($this->client);
        }
        
        if (config('supabase.services.auth', true)) {
            $this->auth = new AuthService($this->client);
        }
        
        if (config('supabase.services.storage', true)) {
            $this->storage = new StorageService($this->client);
        }
        
        if (config('supabase.services.realtime', true)) {
            $this->realtime = new RealtimeService();
        }
    }

    /**
     * Get the Supabase client
     *
     * @return SupabaseClient
     */
    public function getClient(): SupabaseClient
    {
        return $this->client;
    }

    /**
     * Get the Auth service (method accessor for facade compatibility).
     */
    public function auth(): AuthService
    {
        return $this->auth;
    }

    /**
     * Get the Database service (method accessor for facade compatibility).
     */
    public function db(): DatabaseService
    {
        return $this->db;
    }

    /**
     * Get the Storage service (method accessor for facade compatibility).
     */
    public function storage(): StorageService
    {
        return $this->storage;
    }

    /**
     * Get the Realtime service (method accessor for facade compatibility).
     */
    public function realtime(): RealtimeService
    {
        return $this->realtime;
    }

    /**
     * Get information about the Supabase connection
     *
     * @return array
     */
    public function info(): array
    {
        return [
            'url' => config('supabase.url'),
            'connected' => !empty(config('supabase.key')),
            'services' => [
                'auth' => config('supabase.services.auth', true),
                'database' => config('supabase.services.database', true),
                'storage' => config('supabase.services.storage', true),
                'realtime' => config('supabase.services.realtime', true),
            ],
        ];
    }
}