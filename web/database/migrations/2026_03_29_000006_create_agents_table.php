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
        Schema::create('agents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->index();
            $table->string('role')->nullable();
            $table->string('type')->default('general'); // general, backend, frontend, qa, devops, etc.
            $table->string('status')->default('active'); // active, inactive, archived
            $table->text('persona')->nullable();
            $table->text('system_prompt')->nullable();
            $table->string('avatar_color')->nullable(); // gradient color for avatar fallback
            $table->uuid('organization_id')->index();
            $table->uuid('created_by')->nullable();
            $table->json('skills')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['organization_id', 'slug']);

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
        Schema::dropIfExists('agents');
    }
};
