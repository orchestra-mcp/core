<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Matches Supabase: 20260328000002_profiles_organizations.sql (team_members section)
     *
     * Note: The TeamMember model has $timestamps = false. This table uses
     * joined_at instead of created_at/updated_at, matching the Supabase schema.
     */
    public function up(): void
    {
        Schema::create('team_members', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('team_id');
            $table->uuid('user_id');                         // Supabase auth.users UUID
            $table->string('role')->default('member');       // owner, admin, member, viewer
            $table->uuid('invited_by')->nullable();
            $table->timestamp('invited_at')->nullable();
            $table->timestamp('joined_at')->useCurrent();

            $table->unique(['team_id', 'user_id']);
            $table->index('user_id');
            $table->index('team_id');

            $table->foreign('team_id')
                ->references('id')
                ->on('teams')
                ->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('team_members');
    }
};
