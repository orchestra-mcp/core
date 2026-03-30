<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Matches Supabase: 20260328000002_profiles_organizations.sql
     */
    public function up(): void
    {
        Schema::create('organizations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->uuid('owner_id');
            $table->string('plan')->default('free');       // free, pro, team, enterprise
            $table->string('logo_url')->nullable();
            $table->text('description')->nullable();
            $table->string('stripe_customer_id')->nullable();
            $table->string('stripe_subscription_id')->nullable();
            $table->jsonb('settings')->default('{}');
            $table->jsonb('limits')->default(json_encode([
                'max_users' => 1,
                'max_projects' => 1,
                'max_tokens' => 2,
                'max_agents' => 3,
                'max_tasks_per_month' => 100,
                'max_memory_mb' => 50,
            ]));
            $table->jsonb('metadata')->default('{}');
            $table->timestamps();
        });

        // Add foreign key from users.organization_id → organizations.id
        // (column was added in 2026_03_28_000001 without FK constraint)
        Schema::table('users', function (Blueprint $table) {
            $table->foreign('organization_id')
                ->references('id')
                ->on('organizations')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['organization_id']);
        });

        Schema::dropIfExists('organizations');
    }
};
