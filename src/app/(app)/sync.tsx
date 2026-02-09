import React, { useEffect } from 'react'; // Importamos useEffect
import { StyleSheet, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Quitamos Button ya que no lo necesitamos más
import { Provider as PaperProvider, DefaultTheme, ProgressBar, List, Icon, ActivityIndicator as PaperActivityIndicator, useTheme } from 'react-native-paper';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import Animated, { FadeInUp, FadeIn, Layout } from 'react-native-reanimated';

// Componente para la pantalla de Sincronización
const SyncProgressScreen = () => {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const syncProgress = useAuthStore((state) => state.syncProgress);
    const syncInitialData = useAuthStore((state) => state.syncInitialData);
    const currentUser = useAuthStore((state) => state.currentUser);
    const router = useRouter(); // Hook para la navegación

    const progressValue = syncProgress.totalSteps > 0 ? syncProgress.currentStep / syncProgress.totalSteps : 0;
    const progressPercentage = Math.round(progressValue * 100);

    const syncSteps = [
        { key: 1, title: 'Empleados y Empresas', icon: 'account-group-outline' },
        { key: 2, title: 'Dispositivos', icon: 'cellphone-link' },
    ];

    // Efecto para INICIAR la sincronización al entrar a la pantalla
    useEffect(() => {
        // Solo inicia si hay usuario y no está ya sincronizando o completado

        if (currentUser && syncProgress.status !== 'syncing' && syncProgress.status !== 'success') {
            console.log("Iniciando sincronización desde la pantalla de progreso...");
            syncInitialData(currentUser);
        }
    }, [currentUser, syncProgress.status]); // Depende del usuario y el estado de sync

    // Efecto para REDIRIGIR al finalizar la sincronización
    useEffect(() => {
        if (syncProgress.status === 'success') {
            console.log("Sincronización completada, redirigiendo al home...");
            router.replace('/');
        }
    }, [syncProgress.status]); // Depende solo del estado de sync

    // Si por alguna razón llegamos aquí sin usuario, podríamos mostrar un mensaje o redirigir
    if (!currentUser) {
         // Podrías mostrar un ActivityIndicator mientras currentUser se carga inicialmente
         // o redirigir al login si después de un tiempo sigue sin haber usuario.
         // Por ahora, mostramos un mensaje simple.
        return (
             <View style={[styles.syncContainer, { backgroundColor: theme.colors.background }]}><Text style={[styles.syncSubtitle, { color: theme.colors.onSurface }]}>Esperando datos del usuario...</Text></View>
        );
    }

    const isDark = theme.dark;

    return (
        <View style={[
            styles.syncContainer, 
            { 
                backgroundColor: isDark ? theme.colors.background : '#3498db',
                paddingTop: insets.top,
                paddingBottom: insets.bottom
            }
        ]}>
            <Animated.View entering={FadeInUp.delay(200)} style={{ alignItems: 'center' }}>
                <Image
                    source={isDark ? require('@/assets/images/logo.png') : require('@/assets/images/logo-light.png')}
                    style={styles.syncLogo}
                    contentFit="contain"
                    transition={500}
                />
                <Text style={[styles.syncMainTitle, { color: 'white' }]}>Conductores</Text>
            </Animated.View>
            
            <Animated.Text entering={FadeIn.delay(400)} style={[styles.syncSubtitle, { color: 'white' }]}>
                Sincronizando datos del sistema...
            </Animated.Text>

            <Animated.View 
                entering={FadeInUp.delay(600)} 
                layout={Layout} 
                style={[styles.syncListContainer, { backgroundColor: isDark ? theme.colors.surface : 'rgba(255,255,255,0.2)' }]}
            >
                {syncSteps.map((step) => (
                    <List.Item
                        key={step.key}
                        title={step.title}
                        titleStyle={[
                            syncProgress.currentStep >= step.key ? styles.syncStepDoneText : styles.syncStepPendingText,
                            { color: isDark ? theme.colors.onSurface : 'white' }
                        ]}
                        left={() => (
                           <View style={{ justifyContent: 'center', paddingLeft: 10 }}>
                                {syncProgress.currentStep > step.key ? (
                                    <Icon source="check-circle" size={24} color={isDark ? '#4caf50' : '#ffffff'} />
                                ) : syncProgress.currentStep === step.key ? (
                                    <PaperActivityIndicator size={24} color={isDark ? theme.colors.primary : 'white'} />
                                ) : (
                                    <Icon source={step.icon} size={24} color={isDark ? theme.colors.outline : 'rgba(255,255,255,0.5)'} />
                                )}
                           </View>
                        )}
                        style={styles.syncStepItem}
                    />
                ))}
            </Animated.View>

            <Animated.View 
                entering={FadeInUp.delay(800)} 
                style={[styles.progressContainer, { backgroundColor: isDark ? theme.colors.surface : 'rgba(255,255,255,0.2)' }]}
            >
                <View style={styles.progressTextContainer}>
                     <Text style={[styles.progressPercentage, { color: isDark ? theme.colors.primary : 'white' }]}>{progressPercentage}%</Text>
                     <Text style={[styles.progressLabel, { color: isDark ? theme.colors.onSurface : 'white' }]}>{syncProgress.message.replace('Sincronizando ', '')}</Text>
                </View>
                <ProgressBar
                    progress={progressValue}
                    color={isDark ? theme.colors.primary : 'white'}
                    style={styles.progressBar}
                />
            </Animated.View>

             <Animated.Text entering={FadeIn.delay(1000)} style={[styles.syncBottomText, { color: 'white' }]}>
                {syncProgress.message}...
             </Animated.Text>
        </View>
    );
};

// --- Estilos (sin cambios) ---
const styles = StyleSheet.create({
    syncContainer: {
        flex: 1,
        alignItems: 'center',
        paddingTop: 80,
        paddingHorizontal: 20,
    },
    syncLogo: {
        width: 80,
        height: 80,
        marginBottom: 10,
    },
    syncMainTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    syncSubtitle: {
        fontSize: 16,
        marginBottom: 30,
    },
    syncListContainer: {
        width: '100%',
        borderRadius: 15,
        paddingVertical: 15,
        paddingHorizontal: 15,
        marginBottom: 30,
    },
    syncStepItem: {
        paddingVertical: 5,
    },
    syncStepDoneText: {
        fontWeight: 'bold',
    },
    syncStepPendingText: {
    },
    progressContainer: {
        width: '100%',
        padding: 15,
        borderRadius: 15,
        marginBottom: 20,
    },
    progressTextContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    progressPercentage: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    progressLabel: {
        fontSize: 14,
    },
    progressBar: {
        height: 10,
        borderRadius: 5,
    },
    syncBottomText: {
        fontSize: 14,
        marginTop: 10,
    },
});


export default function SyncScreenWrapper() {
    return (
        <SyncProgressScreen />
    );
}
