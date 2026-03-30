<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add public profile fields to users table.
     *
     * These fields power the /@{username} public profile pages,
     * allowing users to share a public-facing presence on Orchestra MCP.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('username')->unique()->nullable()->after('name');
            $table->string('handle')->unique()->nullable()->after('username');
            $table->text('bio')->nullable()->after('handle');
            $table->json('badges')->nullable()->after('bio');
            $table->boolean('is_public')->default(false)->after('badges');
            $table->string('cover_url')->nullable()->after('is_public');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'username',
                'handle',
                'bio',
                'badges',
                'is_public',
                'cover_url',
            ]);
        });
    }
};
