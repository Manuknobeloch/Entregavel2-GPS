import { useState, useEffect, useRef } from "react";
import MapView, { UrlTile, Polyline, Marker } from "react-native-maps";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import { Dimensions } from "react-native";
import { getUserLocation } from "./getUserLocation";
import { fetchAddress } from "./fetchAddress";
import { fetchRoute } from "./fetchRoute";

const { width, height } = Dimensions.get("window");
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.04;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

export default function App() {
  const mapRef = useRef();

  const [userLocation, setUserLocation] = useState(null);
  const [carLocation, setCarLocation] = useState(null);
  const [carAddress, setCarAddress] = useState("");
  const [route, setRoute] = useState(null);

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

  const carMarker =
    carLocation && <Marker coordinate={carLocation} title="Carro" />;

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
    async function loadLocation() {
      const location = await getUserLocation();
      setUserLocation(location);
    }

    loadLocation();
  }, []);

  async function saveCarLocation() {
    if (!userCoords) return;

    const location = {
      latitude: userCoords.latitude,
      longitude: userCoords.longitude,
    };

    setCarLocation(location);

    const address = await fetchAddress(location);
    setCarAddress(address?.display_name || "Endereço não encontrado");
  }

  async function pathToCar() {
    if (!userCoords || !carLocation) return;

    const routeCoords = await fetchRoute(userCoords, carLocation);
    setRoute(routeCoords);

    setTimeout(() => {
      overviewRoute();
    }, 500);
  }

  if (!initialRegion) {
    return (
      <View style={styles.loading}>
        <Text>Carregando mapa...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
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
        {carMarker}
      </MapView>

      <View style={styles.bottomSheet}>
        <Text style={styles.address}>
          {carAddress || "Nenhuma localização salva"}
        </Text>

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
          <Text style={styles.secondaryText}>
            Ir até o carro
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },

  address: {
    fontSize: 16,
    fontWeight: "bold",
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
    borderWidth: 1,
    borderColor: "#2b6cff",
  },

  secondaryText: {
    color: "#2b6cff",
    fontWeight: "bold",
  },
});