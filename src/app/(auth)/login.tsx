import React, { useState } from 'react';
// Importamos Modal y ActivityIndicator de react-native
import { StyleSheet, View, Image, Text, KeyboardAvoidingView, Platform, ScrollView, Modal, ActivityIndicator as NativeActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Mantenemos Snackbar y los componentes de Paper
import { TextInput, Button, Provider as PaperProvider, DefaultTheme, Snackbar, useTheme } from 'react-native-paper'; // Quitamos ProgressBar y List
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'expo-router';


const LoginScreen = () => {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    // 2. Nos conectamos al authStore
    const login = useAuthStore((state) => state.login);
    // Ya no necesitamos syncProgress aquí directamente para mostrar la pantalla
    const router = useRouter();

    const handleLogin = async () => {
        if (!email || !password) {
            setErrorMessage('Por favor, ingresa tu correo y contraseña.');
            return;
        }
        setErrorMessage(null);
        setIsLoggingIn(true);
        try {
            await login({ email, password });
            setPassword('');
            router.replace('/(app)/(tabs)');
            // La navegación ahora la maneja _layout.tsx
        } catch (error: any) {
            const apiErrorMessage = error?.response?.data?.message || error?.message || 'El correo o la contraseña son incorrectos.';
            setErrorMessage(apiErrorMessage);
            console.error(error);
        } finally {
            setIsLoggingIn(false);
        }
    };

    // La pantalla de Login ya NO muestra la pantalla de sincronización
    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={[
                styles.containerWrapperLogin, 
                { 
                    backgroundColor: theme.colors.primary,
                    paddingTop: insets.top,
                    paddingBottom: insets.bottom
                }
            ]}
        >
            {/* Modal de Carga ahora controlado por el estado local 'isLoggingIn' */}
            <Modal
                transparent={true}
                animationType="fade"
                visible={isLoggingIn} // Usamos el estado local
                onRequestClose={() => {}}
            >
                <View style={styles.modalBackground}>
                    <View style={[styles.activityIndicatorWrapper, { backgroundColor: theme.colors.surface }]}>
                        <NativeActivityIndicator size="large" color={theme.colors.primary} />
                        <Text style={[styles.loadingText, { color: theme.colors.onSurface }]}>Ingresando...</Text>
                    </View>
                </View>
            </Modal>

            <ScrollView contentContainerStyle={styles.containerLogin}>
                <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
                    <Image
                        source={require('@/assets/images/logo.png')}
                        style={styles.logo}
                    />
                    <Text style={[styles.title, { color: theme.colors.primary }]}>Inicio de Sesión</Text>

                    <TextInput
                        label="Correo Electrónico"
                        value={email}
                        onChangeText={setEmail}
                        mode="flat"
                        style={[styles.input, { backgroundColor: theme.colors.surface }]}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        textColor={theme.colors.onSurface}
                        underlineColor={theme.colors.onSurface}
                        activeUnderlineColor={theme.colors.primary}
                        disabled={isLoggingIn} // Deshabilitamos si está haciendo login
                    />

                    <TextInput
                        label="Contraseña"
                        value={password}
                        onChangeText={setPassword}
                        mode="flat"
                        style={[styles.input, { backgroundColor: theme.colors.surface }]}
                        secureTextEntry={!isPasswordVisible}
                        right={
                            <TextInput.Icon
                                icon={isPasswordVisible ? "eye-off" : "eye"}
                                onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                                color={theme.colors.placeholder}
                            />
                        }
                        textColor={theme.colors.onSurface}
                        underlineColor={theme.colors.placeholder}
                        activeUnderlineColor={theme.colors.primary}
                        disabled={isLoggingIn} // Deshabilitamos si está haciendo login
                    />

                    <Button
                        mode="contained"
                        onPress={handleLogin}
                        style={styles.button}
                        labelStyle={styles.buttonLabel}
                        // El botón ya no muestra "INGRESANDO..."
                        disabled={isLoggingIn} // Solo se deshabilita
                    >
                        INGRESAR
                    </Button>
                </View>
            </ScrollView>
            {/* Componente Snackbar para mostrar errores */}
            <Snackbar
                visible={!!errorMessage}
                onDismiss={() => setErrorMessage(null)}
                action={{
                    label: 'Cerrar',
                    onPress: () => setErrorMessage(null),
                    textColor: 'white',
                }}
                style={styles.snackbar}
                theme={{ colors: { surface: theme.colors.error } }}
            >
                 <Text style={{ color: 'white' }}>{errorMessage}</Text>
            </Snackbar>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    // --- Estilos Pantalla Login (Se mantienen) ---
    containerWrapperLogin: {
        flex: 1,
    },
    containerLogin: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    card: {
        width: '100%',
        maxWidth: 400,
        borderRadius: 20,
        paddingHorizontal: 25,
        paddingVertical: 35,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 8,
    },
    logo: {
        width: 80,
        height: 80,
        marginBottom: 15,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 35,
    },
    input: {
        width: '100%',
        marginBottom: 20,
    },
    button: {
        width: '100%',
        paddingVertical: 10,
        borderRadius: 50,
        marginTop: 15,
    },
    buttonLabel: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    snackbar: {
        marginHorizontal: 10,
        bottom: 10,
    },
    modalBackground: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'space-around',
        backgroundColor: '#00000040'
    },
    activityIndicatorWrapper: {
        height: 120,
        width: 120,
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    loadingText: {
        marginTop: 10,
    },
    // --- Estilos Pantalla Sincronización (Eliminados de aquí) ---
});

// Quitamos el PaperProvider de aquí, ya está en _layout.tsx
export default function LoginScreenWrapper() {
    return <LoginScreen />;
}