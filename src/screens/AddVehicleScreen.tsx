import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import VehicleSetupScreen from './VehicleSetupScreen';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'AddVehicle'>;

// Reuses the vehicle-setup form as a modal for garages that already have a vehicle.
export default function AddVehicleScreen({ navigation }: Props) {
  return <VehicleSetupScreen onSaved={() => navigation.goBack()} />;
}
