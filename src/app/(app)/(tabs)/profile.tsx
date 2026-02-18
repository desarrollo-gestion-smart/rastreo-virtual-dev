import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, Platform, Alert, Dimensions } from 'react-native'; // Importamos Dimensions
import { Text, Button, useTheme, Icon, Appbar, List, Portal, Modal, TextInput as PaperTextInput } from 'react-native-paper'; // Quitamos TextInput, ActivityIndicator, Card, Avatar
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as Application from 'expo-application';

const { width } = Dimensions.get('window'); // Obtenemos el ancho de la ventana

const ProfileScreen = () => {
    const theme = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const { currentUser, syncInitialData, currentEmployee, changePassword } = useAuthStore();

    const [modalVisible, setModalVisible] = useState(false);
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [oldPasswordVisible, setOldPasswordVisible] = useState(false);
    const [newPasswordVisible, setNewPasswordVisible] = useState(false);
    const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
    const [validationStatus, setValidationStatus] = useState({
        length: false,
        uppercase: false,
        lowercase: false,
        number: false,
        special: false,
    });

    const appVersion = Application.nativeApplicationVersion || '1.0.0';
    const osVersion = `${Platform.OS} ${Platform.Version}`;

    const handleSync = () => {
        if (currentUser) {
            
            syncInitialData(currentUser);
            router.push('/(app)/sync');
        } else {
            Alert.alert("Error", "No se ha podido encontrar un usuario para sincronizar.");
        }
    };
    const handleNewPasswordChange = (text:string) => {
        setNewPassword(text);
        
        // Validación en tiempo real
        setValidationStatus({
            length: text.length >= 8,
            uppercase: /[A-Z]/.test(text),
            lowercase: /[a-z]/.test(text),
            number: /\d/.test(text),
            special: /[\W_]/.test(text) // \W es para no-alfanuméricos, _ es por si \W no lo cubre
        });
    };
    const handleChangePassword = async () => {
        if (newPassword !== confirmPassword) {
            Alert.alert("Error", "Las nuevas contraseñas no coinciden.");
            return;
        }

        // --- CAMBIO AQUÍ ---
        // 1. Revisar si todas las validaciones son 'true'
        const allValid = Object.values(validationStatus).every(status => status === true);

        if (!allValid) {
            Alert.alert("Contraseña no válida", "Por favor, asegúrate de que la nueva contraseña cumpla todos los requisitos.");
            return;
        }
        // --- FIN DEL CAMBIO ---

        // Lógica de API
        setIsSubmitting(true); // Inicia la carga
        try {
            // Llamamos al servicio con los datos
            const result = await changePassword({
                currentPassword: oldPassword,
                newPassword: newPassword,
                confirmPassword: confirmPassword
            });

            Alert.alert("Éxito", result.message);
            setModalVisible(false);

            // Reseteamos los campos
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setValidationStatus({
                length: false, uppercase: false, lowercase: false, number: false, special: false,
            });           

        } catch (error: any) {
            // El servicio ya lanza un Error con el mensaje correcto
            Alert.alert("Error al cambiar contraseña", error.message);
        } finally {
            setIsSubmitting(false); // Finaliza la carga
        }
    };

    const openPasswordModal = () => setModalVisible(true);
    const closePasswordModal = () => setModalVisible(false);

    const avatar =  (typeof currentEmployee?.avatar === 'object' && currentEmployee?.avatar?.url)
                         ? currentEmployee.avatar.url
                         :'https://dummyimage.com/40x40';;

    return (
        <LinearGradient
        // Elige los colores que prefieras para el degradado
        // Ejemplo: de un azul más oscuro a uno un poco más claro
        colors={theme.dark ? [theme.colors.background, theme.colors.surface] : ['#080973', '#4294e0']}
        style={styles.container}
    >
            <ScrollView contentContainerStyle={styles.scrollContainer}>

                {/* Sección del Avatar */}
                <View style={styles.avatarContainer}>
                    <Image
                        source={{ uri: avatar }}
                        style={styles.avatar}
                        contentFit="contain"
                        transition={300}
                    />
                    <Text style={[styles.userName, { color: theme.dark ? theme.colors.onSurface : 'white' }]}>{currentUser?.full_name || 'Nombre de Usuario'}</Text>
                    <View style={styles.statusBadge}>
                        <Text style={styles.statusText}>Activo</Text>
                    </View>
                </View>

                {/* Sección de Información */}
                <List.Section style={styles.infoSection}>
                    <List.Item
                        title="Correo Electrónico"
                        description={currentUser?.email}
                        titleStyle={[styles.listTitle, { color: theme.dark ? theme.colors.onSurfaceVariant : '#ccc' }]}
                        descriptionStyle={[styles.listDescription, { color: theme.dark ? theme.colors.onSurface : 'white' }]}
                        left={() => <Icon source="email-outline" size={24} color={theme.dark ? theme.colors.primary : 'white'} style={styles.listIcon} />}
                    />
                    <List.Item
                        title="Última Sesión"
                        description={currentUser?.last_login} // Dato de ejemplo
                        titleStyle={[styles.listTitle, { color: theme.dark ? theme.colors.onSurfaceVariant : '#ccc' }]}
                        descriptionStyle={[styles.listDescription, { color: theme.dark ? theme.colors.onSurface : 'white' }]}
                        left={() => <Icon source="clock-outline" size={24} color={theme.dark ? theme.colors.primary : 'white'} style={styles.listIcon} />}
                    />
                    <List.Item
                        title="Conductores"
                        description={`Versión: ${appVersion} | OS: ${osVersion}`}
                        titleStyle={[styles.listTitle, { color: theme.dark ? theme.colors.onSurfaceVariant : '#ccc' }]}
                        descriptionStyle={[styles.listDescription, { color: theme.dark ? theme.colors.onSurface : 'white' }]}
                        left={() => <Icon source="cellphone" size={24} color={theme.dark ? theme.colors.primary : 'white'} style={styles.listIcon} />}
                    />
                </List.Section>

                {/* Botones de Acción */}
                <View style={styles.buttonContainer}>
                    {/* Cambiar Contraseña */}
                    <LinearGradient
                        colors={['#E91E63', '#9C27B0']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.buttonGradient}
                    >
                        <Button
                            mode="contained"
                            onPress={openPasswordModal}
                            style={styles.button}
                            labelStyle={styles.buttonLabel}
                            icon={({ color }) => (
        <Icon source="lock-reset" color={color} size={24} />
    )}
                        >
                            Cambiar Contraseña
                        </Button>
                    </LinearGradient>

                    <LinearGradient
                        colors={['#4294e0','#080973']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.buttonGradient}
                    >
                    <Button
                        mode="contained"
                        onPress={handleSync}
                        style={styles.button}
                        labelStyle={styles.buttonLabel}
                       icon={({ color }) => (
        <Icon source="sync" color={color} size={24} />
    )}
                    >
                        Sincronizar Datos
                    </Button>
                    </LinearGradient>
                </View>

            </ScrollView>

            {/* Portal para el Modal de Contraseña */}
            <Portal >
                <Modal visible={modalVisible} onDismiss={closePasswordModal} contentContainerStyle={styles.modalContentWrapper}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
                        {/* Header del Modal */}
                         <LinearGradient
                                    colors={['#E91E63', '#9C27B0']} // Gradiente del header
                                    style={[styles.modalAppbar]}
                                >
                        <Appbar.Header style={styles.modalHeader}>
                            <Appbar.BackAction onPress={closePasswordModal} color="white" />
                            <Appbar.Content title="Cambiar Contraseña" titleStyle={styles.modalTitle} />
                        </Appbar.Header>
                        </LinearGradient>

                        <ScrollView contentContainerStyle={styles.modalScrollContent}>
                           <PaperTextInput
                                label="Contraseña Actual"
                                value={oldPassword}
                                onChangeText={setOldPassword}
                                // --- ACTUALIZADO ---
                                secureTextEntry={!oldPasswordVisible}
                                mode="flat"
                                style={[styles.modalInput, { backgroundColor: theme.colors.surface, borderBottomColor: theme.dark ? '#444' : '#E0E0E0' }]}
                                theme={{ colors: { background: theme.colors.surface } }}
                                right={
                                    <PaperTextInput.Icon 
                                        icon={oldPasswordVisible ? "eye-off-outline" : "eye-outline"} 
                                        color="gray" 
                                        onPress={() => setOldPasswordVisible(!oldPasswordVisible)}
                                    />
                                }
                                // --- FIN ACTUALIZACIÓN ---
                            />
                            <PaperTextInput
                                label="Nueva Contraseña"
                                value={newPassword}
                                // --- ACTUALIZADO ---
                                onChangeText={handleNewPasswordChange} // Usamos la nueva función
                                secureTextEntry={!newPasswordVisible}
                                mode="flat"
                                style={[styles.modalInput, { backgroundColor: theme.colors.surface, borderBottomColor: theme.dark ? '#444' : '#E0E0E0' }]}
                                theme={{ colors: { background: theme.colors.surface } }}
                                right={
                                    <PaperTextInput.Icon 
                                        icon={newPasswordVisible ? "eye-off-outline" : "eye-outline"} 
                                        color="gray" 
                                        onPress={() => setNewPasswordVisible(!newPasswordVisible)}
                                    />
                                }
                                // --- FIN ACTUALIZACIÓN ---
                            />
                            <PaperTextInput
                                label="Confirmar Nueva Contraseña"
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                // --- ACTUALIZADO ---
                                secureTextEntry={!confirmPasswordVisible}
                                mode="flat"
                                style={[styles.modalInput, { backgroundColor: theme.colors.surface, borderBottomColor: theme.dark ? '#444' : '#E0E0E0' }]}
                                theme={{ colors: { background: theme.colors.surface } }}
                                right={
                                    <PaperTextInput.Icon 
                                        icon={confirmPasswordVisible ? "eye-off-outline" : "eye-outline"} 
                                        color="gray" 
                                        onPress={() => setConfirmPasswordVisible(!confirmPasswordVisible)}
                                    />
                                }
                                // --- FIN ACTUALIZACIÓN ---
                            />

                            {/* --- CONTENEDOR DE AYUDA ACTUALIZADO --- */}
                            <View style={[styles.passwordHelperContainer, { backgroundColor: theme.dark ? '#2c2c2c' : '#E3F2FD' }]}>
                                <Text style={[styles.passwordHelperTitle, { color: theme.dark ? theme.colors.onSurface : '#37474F' }]}>La contraseña debe tener:</Text>
                                <Text style={[styles.ruleText, validationStatus.length ? styles.ruleValid : [styles.ruleInvalid, { color: theme.dark ? theme.colors.onSurfaceVariant : '#37474F' }]]}>
                                    <Icon source={validationStatus.length ? "check-circle" : "close-circle"} size={16} /> Al menos 8 caracteres
                                </Text>
                                <Text style={[styles.ruleText, validationStatus.uppercase ? styles.ruleValid : [styles.ruleInvalid, { color: theme.dark ? theme.colors.onSurfaceVariant : '#37474F' }]]}>
                                    <Icon source={validationStatus.uppercase ? "check-circle" : "close-circle"} size={16} /> Al menos una mayúscula (A-Z)
                                </Text>
                                <Text style={[styles.ruleText, validationStatus.lowercase ? styles.ruleValid : [styles.ruleInvalid, { color: theme.dark ? theme.colors.onSurfaceVariant : '#37474F' }]]}>
                                    <Icon source={validationStatus.lowercase ? "check-circle" : "close-circle"} size={16} /> Al menos una minúscula (a-z)
                                </Text>
                                <Text style={[styles.ruleText, validationStatus.number ? styles.ruleValid : [styles.ruleInvalid, { color: theme.dark ? theme.colors.onSurfaceVariant : '#37474F' }]]}>
                                    <Icon source={validationStatus.number ? "check-circle" : "close-circle"} size={16} /> Al menos un número (0-9)
                                </Text>
                                <Text style={[styles.ruleText, validationStatus.special ? styles.ruleValid : [styles.ruleInvalid, { color: theme.dark ? theme.colors.onSurfaceVariant : '#37474F' }]]}>
                                    <Icon source={validationStatus.special ? "check-circle" : "close-circle"} size={16} /> Al menos un carácter especial (ej. !@#$)
                                </Text>
                            </View>

                            {/* Botón Cambiar Contraseña */}
                            <LinearGradient
                                colors={['#3a47d5', '#0072ff']} // Colores del gradiente del botón
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.modalButtonGradient}
                            >
                                <Button
                                    mode="contained"
                                    onPress={handleChangePassword}
                                    style={styles.modalSubmitButton}
                                    labelStyle={styles.modalButtonLabel}
                                     loading={isSubmitting} // Añadido
                                    disabled={isSubmitting} // Añadido
                                >
                                    Cambiar contraseña
                                </Button>
                            </LinearGradient>
                        </ScrollView>
                    </View>
                </Modal>
            </Portal>

        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContainer: {
        paddingHorizontal: 20,
        paddingTop: 30,
        paddingBottom: 100,
    },
    avatarContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    avatar: {
        width: 120,
        height: 120,
        marginBottom: 15,
        borderRadius: 60,
    },
    userName: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    statusBadge: {
        backgroundColor: 'green',
        borderRadius: 50,
        paddingHorizontal: 15,
        paddingVertical: 3,
    },
    statusText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    infoSection: {
        marginBottom: 20,
        paddingStart:20
    },
    listIcon: {
        marginRight: 10,
        marginLeft: 8,
    },
    listTitle: {
        color: '#ccc',
        fontSize: 12,
    },
    listDescription: {
        color: 'white',
        fontSize: 16,
        fontWeight: '500',
    },
    buttonContainer: {
        marginTop: 10,
    },
    buttonGradient: {
        borderRadius: 50,
        marginBottom: 15,
        elevation: 5,
    },
    button: {
        paddingVertical: 8,
        backgroundColor: 'transparent',
    },
    buttonLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: 'white',
    },
    syncButton: {
        borderRadius: 50,
        marginBottom: 15,
        elevation: 5,
        paddingVertical: 8,
        backgroundColor: '#0288D1',
    },
    // --- ESTILOS DEL MODAL ACTUALIZADOS PARA LA IMAGEN ---
    modalContentWrapper: {
        flex: 1,
        justifyContent: 'flex-start', // Alinea el modal en la parte superior
        alignItems: 'center',
        paddingHorizontal: 0, // Quitamos padding horizontal aquí para que el modal ocupe todo el ancho
        marginBottom: 0,
        marginTop: 0,
        // El color del fondo oscuro se maneja por defecto en Modal de Paper,
        // o si queremos un color específico podemos usar overlayColor
    },
    modalContent: {
        width: '100%', // El modal ocupa todo el ancho
        flex: 1, // El modal ocupa todo el alto disponible
        borderRadius: 0, // No hay bordes redondeados para un modal de pantalla completa
        // padding: 25, // No hay padding general, el contenido lo tendrá
        alignItems: 'stretch',
        elevation: 0, // Quitamos la elevación si es pantalla completa
    },
    modalHeader: {
        backgroundColor: 'transparent', // Para que el gradiente de arriba se vea
        elevation: 0,
        height: 60, // Altura del header
        justifyContent: 'flex-start',
        paddingHorizontal: 10, // Un poco de padding horizontal para los iconos
        // Añadir gradiente para el header
    },
    modalAppbar: {
        paddingBottom: 15,
        elevation: 4,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'left', // Alineado a la izquierda
        color: 'white', // Color del título
        marginLeft: -10, // Ajusta el margen si el BackAction es muy grande
    },
    modalScrollContent: {
        paddingHorizontal: 20, // Padding para el contenido dentro del ScrollView
        paddingTop: 20,
        paddingBottom: 20,
    },
    modalInput: {
        marginBottom: 15,
        paddingHorizontal: 0,
        fontSize: 16, // Tamaño de fuente del texto
        borderBottomWidth: 1, // Borde inferior
    },
    // Estilo para el contenedor del mensaje de ayuda de la contraseña
   passwordHelperContainer: {
        borderRadius: 8,
        padding: 15,
        marginTop: 20,
        marginBottom: 30,
    },
    infoIcon: { // (Este ya no lo usamos, puedes borrarlo si quieres)
        marginRight: 10,
        marginTop: 2,
    },
    passwordHelperText: { // (Este ya no lo usamos, puedes borrarlo si quieres)
        flex: 1, 
        fontSize: 13,
        lineHeight: 18,
        color: '#37474F',
    },
    modalButtonGradient: {
        borderRadius: 50,
        marginTop: 10,
        elevation: 5,
    },
    modalSubmitButton: {
        paddingVertical: 8,
        backgroundColor: 'transparent', // El gradiente maneja el color
    },
    modalButtonLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: 'white',
    },

    passwordHelperTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#37474F',
        marginBottom: 10,
    },
    ruleText: {
        fontSize: 13,
        lineHeight: 22, // Aumenta el espaciado
        alignItems: 'center', // Alinea el icono con el texto
    },
    ruleInvalid: {
        color: '#37474F', // Color de texto oscuro (default)
    },
    ruleValid: {
        color: '#2E7D32', // Verde oscuro para validez
        fontWeight: '500',
    },
    // --- FIN DE ESTILOS AÑADIDOS ---

    
    // Eliminamos el modalCancelButton ya que no está en la imagen
    // modalCancelButton: {
    //     marginTop: 5,
    // },
});

export default ProfileScreen;
