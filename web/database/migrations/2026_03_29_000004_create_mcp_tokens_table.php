<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Matches Supabase: 20260328000003_mcp_tokens.sql
     *
     * Note: The McpToken model sets UPDATED_AT = null — this table
     * intentionally has created_at but no updated_at column.
     */
    public function up(): void
    {
        Schema::create('mcp_tokens', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('organization_id');
            $table->string('token_hash')->unique();          // SHA-256 hash
            $table->string('token_prefix');                   // "orch_xxxxxxxx" display prefix
            $table->string('name')->default('default');
            $table->text('scopes')->nullable();               // PostgreSQL TEXT[] — stored as {read,write}
            $table->timestamp('last_used_at')->nullable();
            $table->string('last_used_ip')->nullable();
            $table->unsignedInteger('usage_count')->default(0);
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index('user_id');
            $table->index('organization_id');

            $table->foreign('organization_id')
                ->references('id')
                ->on('organizations')
                ->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('mcp_tokens');
    }
};
