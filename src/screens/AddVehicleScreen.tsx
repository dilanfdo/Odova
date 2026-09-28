import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import VehicleSetupScreen from './VehicleSetupScreen';
import { useGarage } from '../context/GarageContext';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'AddVehicle'>;

// Reuses the vehicle-setup form as a modal for garages that already have a vehicle,
// or (with an editId param) to edit one that already exists.
export default function AddVehicleScreen({ navigation, route }: Props) {
  const { vehicles } = useGarage();
  const editVehicle = route.params?.editId
    ? vehicles.find((v) => v.id === route.params!.editId)
    : undefined;
  return (
    <VehicleSetupScreen
      editVehicle={editVehicle}
      onSaved={() => navigation.goBack()}
      onClose={() => navigation.goBack()}
    />
  );
}
