<?php

namespace App\Services;

use Saeedvir\Supabase\Facades\Supabase;
use Saeedvir\Supabase\Services\DatabaseService;

/**
 * Thin wrapper around the Supabase SDK (saeedvir/supabase).
 *
 * Legacy code can continue to call get/post/patch/delete on this service.
 * Internally all calls delegate to the SDK's DatabaseService.
 */
class SupabaseService
{
    private ?DatabaseService $db = null;

    /**
     * Lazily resolve the SDK's DatabaseService to avoid boot-order issues.
     */
    private function db(): DatabaseService
    {
        return $this->db ??= Supabase::db();
    }

    /**
     * Select rows from a Supabase table.
     */
    public function get(string $table, array $filters = [], array $options = []): array
    {
        return $this->db()->select($table, '*', $filters, $options);
    }

    /**
     * Insert a row into a Supabase table.
     */
    public function post(string $table, array $data): array
    {
        return $this->db()->insert($table, $data);
    }

    /**
     * Update rows in a Supabase table.
     */
    public function patch(string $table, array $filters, array $data): array
    {
        return $this->db()->update($table, $filters, $data);
    }

    /**
     * Delete rows from a Supabase table.
     */
    public function delete(string $table, array $filters): array
    {
        return $this->db()->delete($table, $filters);
    }

    /**
     * Execute a Supabase RPC function.
     */
    public function rpc(string $functionName, array $params = []): array
    {
        return $this->db()->rpc($functionName, $params);
    }
}
