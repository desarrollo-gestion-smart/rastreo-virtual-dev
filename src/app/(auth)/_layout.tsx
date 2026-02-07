import { Stack } from 'expo-router';
import React from 'react';

// Este layout simple envuelve todas las pantallas de autenticación
// (login, register, forgot-password, etc.)
export default function AuthLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }} />
    );
}