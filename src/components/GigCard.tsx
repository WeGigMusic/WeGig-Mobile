import React from "react";
import { View, Text, Pressable } from "react-native";
import type { Gig } from "../types/gig";

export function GigCard(props: {
  gig: Gig;
  onPress?: () => void;
}) {
  const { gig } = props;

  const Card = (
    <View
      style={{
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.1)",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "800" }}>{gig.artist}</Text>
      <Text style={{ opacity: 0.8 }}>
        {gig.venue} • {gig.city}
      </Text>
      <Text style={{ opacity: 0.6 }}>{gig.date}</Text>

      {gig.rating ? (
        <Text style={{ marginTop: 6 }}>⭐ {gig.rating}/5</Text>
      ) : null}

      {gig.notes ? (
        <Text style={{ marginTop: 6, opacity: 0.8 }}>{gig.notes}</Text>
      ) : null}
    </View>
  );

  if (!props.onPress) return Card;

  return (
    <Pressable onPress={props.onPress} style={{}}>
      {Card}
    </Pressable>
  );
}
