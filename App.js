import { useState, useEffect, useRef } from "react";
import MapView, { UrlTile, Polyline, Marker } from "react-native-maps";
import { StyleSheet, View, Text, TouchableOpacity, Animated } from "react-native";
import { Dimensions } from "react-native";
import * as SecureStore from "expo-secure-store";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { getUserLocation } from "./getUserLocation";
import { watchUserLocation } from "./watchUserLocation";
import { fetchAddress } from "./fetchAddress";
import { fetchRoute } from "./fetchRoute";

const { width, height } = Dimensions.get("window");
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.04;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

export default function App() {
  const mapRef = useRef();
  const panY = useRef(new Animated.Value(1)).current;

  const [userLocation, setUserLocation] = useState(null);
  const [carLocation, setCarLocation] = useState(null);
  const [carAddress, setCarAddress] = useState("");
  const [carLocationTime, setCarLocationTime] = useState(null);
  const [route, setRoute] = useState(null);
  const [showSuccessBadge, setShowSuccessBadge] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const userCoords = userLocation?.coords;

  const initialRegion =
    userCoords && {
      latitude: userCoords.latitude,
      longitude: userCoords.longitude,
      latitudeDelta: LATITUDE_DELTA,
      longitudeDelta: LONGITUDE_DELTA,
    };

  const routePolyline =
    route && (
      <Polyline
        coordinates={route}
        strokeWidth={4}
        strokeColor="#2b6cff"
      />
    );

  const userMarker =
    userCoords && (
      <Marker
        coordinate={{
          latitude: userCoords.latitude,
          longitude: userCoords.longitude,
        }}
        title="Minha localização"
        pinColor="blue"
      />
    );

  const carMarker =
    carLocation && (
      <Marker
        coordinate={carLocation}
        title="Carro"
        tracksViewChanges={false}
      >
        <View style={styles.carMarkerContainer}>
          <FontAwesome name="car" size={24} color="black" />
        </View>
      </Marker>
    );

  function overviewRoute() {
    if (!route) return;

    const coordsA = route.at(0);
    const coordsB = route.at(-1);

    const latCenter = (coordsA.latitude + coordsB.latitude) / 2;
    const lngCenter = (coordsA.longitude + coordsB.longitude) / 2;

    const latDelta =
      Math.abs(coordsA.latitude - coordsB.latitude) * 1.5;
    const longDelta =
      Math.abs(coordsA.longitude - coordsB.longitude) * 1.5;

    mapRef.current.animateToRegion(
      {
        latitude: latCenter,
        longitude: lngCenter,
        latitudeDelta: latDelta,
        longitudeDelta: longDelta,
      },
      1000
    );
  }

  useEffect(() => {
    async function startWatchingLocation() {
      const location = await getUserLocation();
      setUserLocation(location);

      const subscription = await watchUserLocation((location) => {
        setUserLocation(location);
      });

      return subscription;
    }

    async function loadSavedCarLocation() {
      try {
        const savedData = await SecureStore.getItemAsync("carLocation");
        if (savedData) {
          const data = JSON.parse(savedData);
          setCarLocation(data.location);
          setCarAddress(data.address);
          setCarLocationTime(new Date(data.time));
        }
      } catch (error) {
        console.error("Erro ao carregar localização salva:", error);
      }
    }

    let subscription;
    startWatchingLocation().then((sub) => {
      subscription = sub;
    });

    loadSavedCarLocation();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  async function saveCarLocation() {
    if (!userCoords) return;

    const location = {
      latitude: userCoords.latitude,
      longitude: userCoords.longitude,
    };

    const address = await fetchAddress(location);
    const addressText = address?.display_name || "Endereço não encontrado";
    const currentTime = new Date();

    setCarLocation(location);
    setCarLocationTime(currentTime);
    setCarAddress(addressText);
    setShowSuccessBadge(true);

    try {
      await SecureStore.setItemAsync(
        "carLocation",
        JSON.stringify({
          location,
          address: addressText,
          time: currentTime.toISOString(),
        })
      );
    } catch (error) {
      console.error("Erro ao salvar localização:", error);
    }

    setTimeout(() => {
      setShowSuccessBadge(false);
    }, 3000);
  }

  async function pathToCar() {
    if (!userCoords || !carLocation) return;

    const routeCoords = await fetchRoute(userCoords, carLocation);
    setRoute(routeCoords);

    setTimeout(() => {
      overviewRoute();
    }, 500);
  }

  const toggleBottomSheet = () => {
    setIsExpanded(!isExpanded);
    Animated.spring(panY, {
      toValue: isExpanded ? 0 : 1,
      useNativeDriver: false,
    }).start();
  };

  if (!initialRegion) {
    return (
      <View style={styles.loading}>
        <Text>Carregando mapa...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {showSuccessBadge && (
        <View style={styles.successBadge}>
          <Text style={styles.badgeText}>✓ Localização salva com sucesso</Text>
        </View>
      )}
      <MapView
        ref={mapRef}
        style={styles.map}
        mapType="none"
        initialRegion={initialRegion}
      >
        <UrlTile
          urlTemplate="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
          maximumZ={19}
          flipY={false}
        />

        {routePolyline}
        {userMarker}
        {carMarker}
      </MapView>

      <Animated.View
        style={[
          styles.bottomSheet,
          {
            maxHeight: panY.interpolate({
              inputRange: [0, 1],
              outputRange: [80, 400],
            }),
          },
        ]}
      >
        <TouchableOpacity
          style={styles.handle}
          onPress={toggleBottomSheet}
          activeOpacity={0.7}
        >
          <View style={styles.handleBar} />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.bottomSheetContent}>
            <Text style={styles.address}>
              {carAddress || "Nenhuma localização salva"}
            </Text>
            {carLocationTime && (
              <Text style={styles.timestamp}>
                Estacionado há {Math.floor((new Date() - carLocationTime) / 60000)} min - {carLocationTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </Text>
            )}

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={saveCarLocation}
            >
              <Text style={styles.primaryText}>
                Marcar localização do carro
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={pathToCar}
            >
              <FontAwesome name="location-arrow" size={24} color="#2b6cff" />
              <Text style={styles.secondaryText}>
                Ir até o carro
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  successBadge: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: "#2b6cff",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },

  badgeText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
  },

  carMarkerContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#2b6cff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },

  map: {
    width: "100%",
    height: "100%",
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },

  handle: {
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: "#ccc",
    borderRadius: 2,
  },

  bottomSheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  address: {
    fontSize: 16,
    fontWeight: "bold",
  },

  timestamp: {
    fontSize: 13,
    color: "#666",
    marginTop: 8,
    fontWeight: "500",
  },

  primaryButton: {
    marginTop: 15,
    backgroundColor: "#2b6cff",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },

  primaryText: {
    color: "#fff",
    fontWeight: "bold",
  },

  secondaryButton: {
    marginTop: 10,
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#2b6cff",
  },

  secondaryText: {
    color: "#2b6cff",
    fontWeight: "bold",
    marginLeft: 10,
  },
});