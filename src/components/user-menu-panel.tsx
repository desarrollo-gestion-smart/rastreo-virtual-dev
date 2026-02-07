import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { Text, Divider, List, useTheme, DefaultTheme, TextInput } from 'react-native-paper';
import { useAuthStore } from '@/store/authStore';
import { useCompanyStore } from '@/store/companyStore';
import { RelativePathString, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

// Define las props que recibirá el contenido del drawer
interface UserMenuPanelProps {
    navigation: any;
}

const UserMenuPanel: React.FC<UserMenuPanelProps> = (props) => {
    const theme = useTheme();
    const router = useRouter();
    const { currentEmployee,currentUser, logout } = useAuthStore();
    const { currentCompany, companies, setCurrentCompany } = useCompanyStore();
    const [searchQuery, setSearchQuery] = useState('');
    // NUEVO: Estado para controlar si el Accordion está expandido
    const [isCompanyAccordionExpanded, setIsCompanyAccordionExpanded] = useState(false);

     const avatarUrl = (typeof currentEmployee?.avatar === 'object' && currentEmployee?.avatar?.url)
                         ? currentEmployee.avatar.url
                         :'https://dummyimage.com/40x40';
    const userName = currentUser?.full_name || 'Usuario';
    const userEmail = currentUser?.email || '';
    const companyLogo = currentCompany?.logo?.url || 'https://dummyimage.com/40x40';

    const handleNavigate = (route: any) => {
        props.navigation.closeDrawer();
        router.push(route);
    };

    const handleLogout = async() => {
        props.navigation.closeDrawer();
        await logout();
        router.replace('/login');
    };

    const filteredCompanies = companies.filter(company =>
        company.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelectCompany = (companyId: number) => {
        setCurrentCompany(companyId);
        setSearchQuery(''); // Limpia búsqueda
        setIsCompanyAccordionExpanded(false); // Contrae el Accordion
    };
    const placeholderColor = 'rgba(255,255,255,1)';
    return (
        // Aplicamos el gradiente principal al fondo
        <LinearGradient
            colors={theme.dark ? ['#0a0f2b', '#1a2a6c'] : ['#182FB0', '#01C9FD']} // Azul oscuro a cian
            style={{ flex: 1 }}
        >
            <DrawerContentScrollView {...props} style={styles.container}>
                {/* Sección Info Usuario - Estilo Tarjeta */}
                <LinearGradient
                     colors={theme.dark ? ['rgba(50, 50, 50, 0.8)', 'rgba(30, 30, 30, 0.8)'] : ['rgba(196, 25, 77, 0.5)', 'rgba(157, 0, 116, 0.5)']}
                     start={{ x: 0, y: 0 }}
                     end={{ x: 1, y: 1 }}
                     style={styles.userCard}
                 >
                    <Image
                        style={styles.userAvatar}
                        source={{ uri: avatarUrl }}
                        placeholder={'https://via.placeholder.com/50/FFFFFF/000000?text=U'}
                        contentFit="cover"
                        transition={300}
                    />
                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>{userName}</Text>
                        <Text style={[styles.userEmail, { color: theme.dark ? theme.colors.primary : '#F5724E' }]}>{userEmail}</Text>
                    </View>
                </LinearGradient>

                {/* Sección Empresa con Búsqueda */}
                <List.Section title="EMPRESA" titleStyle={styles.sectionTitle}>
                    <List.Accordion
                        title={currentCompany?.name || "Seleccionar Empresa"}
                        left={() => (
                             <Image
                                style={styles.companyLogo}
                                source={{ uri: companyLogo }}
                                placeholder={'https://via.placeholder.com/40/CCCCCC/FFFFFF?text=L'}
                                contentFit="cover"
                                transition={300}
                             />
                        )}
                        style={[styles.listItem, styles.companyItem]}
                        titleStyle={styles.listItemTitle}
                        theme={{ colors: { background: 'transparent' }}}
                         right={props => <List.Icon {...props} icon={isCompanyAccordionExpanded ? "chevron-up" : "chevron-down"} color="white"/>} // Icono dinámico
                         titleNumberOfLines={1}
                         // Controlamos el estado expandido
                         expanded={isCompanyAccordionExpanded}
                         onPress={() => setIsCompanyAccordionExpanded(!isCompanyAccordionExpanded)}
                    >
                        {/* Input de Búsqueda estilo Flat */}
                        <TextInput
                            label="Buscar empresa..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            mode="flat"
                            style={styles.searchInput}
                            dense
                             // Ajustamos el theme para flat mode
                            theme={{
                            colors:{
                                primary: 'white', // Color de la línea activa y label flotante
                                text: 'white', // Color del texto introducido
                                placeholder: placeholderColor, // Color del label cuando no está enfocado
                                background: 'transparent', // Fondo transparente                    
                            },
                            roundness: 0 // Sin bordes redondeados para flat
                            }}
                            textColor='white' // Color explícito
                            underlineColor='rgba(255, 255, 255, 0.5)' // Línea inactiva
                            activeUnderlineColor='white' // Línea activa
                            placeholderTextColor={placeholderColor}
                        />
                        {filteredCompanies.map(company => (
                             <List.Item
                                  key={company.id}
                                  title={company.name}
                                  onPress={() => handleSelectCompany(company.id)}
                                  style={styles.subListItem}
                                  titleStyle={company.id === currentCompany?.id ? styles.activeSubListItem : styles.subListItemTitle}
                             />
                        ))}
                         {filteredCompanies.length === 0 && searchQuery !== '' && (
                             <Text style={styles.noResultsText}>No se encontraron empresas.</Text>
                         )}
                    </List.Accordion>
                </List.Section>


                <Divider style={styles.divider} />

              {/*   Sección Desarrollo
                <List.Section title="DESARROLLO" titleStyle={styles.sectionTitle}>
                    <List.Item
                        title="Storybook de Preguntas"
                        description="Vista previa de componentes UI"
                        left={props => <List.Icon {...props} icon="bug-outline" color={'white'}/>}
                        onPress={handleDevPreview}
                        style={styles.listItem}
                        titleStyle={styles.listItemTitleWhite}
                        descriptionStyle={styles.listItemDescriptionWhite}
                    />
                </List.Section>

                <Divider style={styles.divider} />*/}

                {/* Sección Cuenta */}
                <List.Section title="CUENTA" titleStyle={styles.sectionTitle}>
                    <List.Item
                        title="Historial de Posiciones"
                        description="Ver posiciones registradas"
                        left={props => <List.Icon {...props} icon="map-marker-path" color={'white'}/>}
                        onPress={() => handleNavigate('/(tabs)/locations')}
                        style={styles.listItem}
                        titleStyle={styles.listItemTitleWhite}
                        descriptionStyle={styles.listItemDescriptionWhite}
                    />
                    <List.Item
                        title="Perfil"
                        description="Gestionar tu perfil"
                        left={props => <List.Icon {...props} icon="account-circle-outline" color={'white'}/>}
                        onPress={() => handleNavigate('/(tabs)/profile')}
                        style={styles.listItem}
                        titleStyle={styles.listItemTitleWhite}
                        descriptionStyle={styles.listItemDescriptionWhite}
                    />
                    <List.Item
                        title="Cerrar Sesión"
                        description="Salir de la aplicación"
                        left={props => <List.Icon {...props} icon="logout" color={'white'}/>}
                        onPress={handleLogout}
                        style={styles.listItem}
                        titleStyle={[styles.listItemTitle, { color: 'white' }]}
                        descriptionStyle={styles.listItemDescriptionWhite}
                    />
                </List.Section>
            </DrawerContentScrollView>
        </LinearGradient>
    );
};

// --- Estilos Actualizados ---
const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    userCard: {
        marginHorizontal: 15,
        marginTop: 40,
        marginBottom: 20,
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    userAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 12,
        flexShrink: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
        lineHeight: 18,
        marginBottom: 2,
    },
    userEmail: {
        fontSize: 12,
        fontWeight: '400',
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '800',
        marginLeft: 15,
        marginTop: 15,
        marginBottom: 5,
        color: 'rgba(255, 255, 255, 1)',
        textTransform: 'uppercase',
    },
    listItem: {
        paddingVertical: 8,
        paddingHorizontal: 15,
    },
    companyItem: {
         borderRadius: 8,
         marginHorizontal: 10,
    },
     listItemTitle: {
        fontWeight: '500',
        fontSize: 15,
        marginLeft: 10,
        color: 'white',
    },
     listItemTitleWhite: {
         fontWeight: '500',
         fontSize: 15,
         marginLeft: 10,
         color: 'white',
     },
    listItemDescription: {
        fontSize: 12,
        marginLeft: 10,
        color: 'rgba(255, 255, 255, 0.7)',
    },
     listItemDescriptionWhite: {
         fontSize: 12,
         marginLeft: 10,
         color: 'rgba(255, 255, 255, 0.7)',
     },
    divider: {
        marginVertical: 15,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        marginHorizontal: 15,
    },
    companyLogo: {
         width: 30,
         height: 30,
        borderRadius: 15,
         alignSelf: 'center',
         marginLeft: -5,
         marginRight: 10,
         backgroundColor: 'rgba(255, 255, 255, 0.8)',
    },
    searchInput: {
        marginHorizontal: 15,
        marginTop: 5,
        marginBottom: 10,
        height: 60, // Ajusta altura si es necesario con flat
        backgroundColor: 'transparent', // Fondo transparente para flat
        paddingHorizontal: 0, // Quitar padding horizontal si TextInput lo añade
        color:"#fff"
    },
    subListItem: {
         paddingLeft: 25,
         backgroundColor: 'rgba(0, 0, 0, 0.1)'
    },
    activeSubListItem: {
         fontWeight: 'bold',
         color: 'white',
    },
     subListItemTitle: {
         fontWeight: 'normal',
         color: 'rgba(255, 255, 255, 0.8)',
    },
    noResultsText: {
        paddingLeft: 25,
        paddingVertical: 10,
        color: 'rgba(255, 255, 255, 0.6)',
        fontStyle: 'italic',
        backgroundColor: 'rgba(0, 0, 0, 0.1)'
    }
});

export default UserMenuPanel;