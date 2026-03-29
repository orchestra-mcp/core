<?php

namespace Tests\Feature;

use Tests\TestCase;

class ExampleTest extends TestCase
{
    /**
     * A basic feature test — verifies the app boots correctly.
     */
    public function test_application_environment(): void
    {
        $this->assertTrue(app()->isLocal() || app()->environment('testing'));
    }
}
