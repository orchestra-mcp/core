<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->uuid('supabase_user_id')->nullable()->unique()->after('id');
            $table->uuid('organization_id')->nullable()->after('supabase_user_id');
            $table->boolean('onboarding_completed')->default(false)->after('email');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['supabase_user_id', 'organization_id', 'onboarding_completed']);
        });
    }
};
