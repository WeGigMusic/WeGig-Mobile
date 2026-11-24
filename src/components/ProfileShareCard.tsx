import React from "react";
import { Image, ImageBackground, ImageSourcePropType, Platform, StyleSheet, Text, View } from "react-native";

type Props = {
  name: string;
  avatar?: ImageSourcePropType;
  total: number;
  artists: number;
  venues: number;
  cities: number;
  topArtist: string;
  topArtistCount: number;
};

export default function ProfileShareCard({name, avatar, total, artists, venues, cities, topArtist, topArtistCount}: Props) {
  return (
    <ImageBackground source={require("../../assets/share/profile-background.png")} style={styles.card} resizeMode="stretch">
      <Image source={require("../../assets/wegig-logo.png")} style={styles.logo} resizeMode="contain" />
      <View style={styles.hero}>
        <View style={styles.frame}>
          {avatar ? <Image source={avatar} style={styles.photo} /> : <View style={styles.fallback}><Text style={styles.initial}>{name.charAt(0).toUpperCase()}</Text></View>}
        </View>
        <View style={styles.heroRight}>
          <Text style={styles.name} numberOfLines={2} adjustsFontSizeToFit>{name.toUpperCase()}</Text>
          <ImageBackground source={require("../../assets/share/blue-paper.png")} style={styles.paper} resizeMode="stretch">
            <Text style={styles.total} numberOfLines={1} adjustsFontSizeToFit>{total}</Text>
          </ImageBackground>
          <Text style={styles.label}>GIGS ATTENDED</Text>
        </View>
      </View>
      <View style={styles.stats}>
        {[[artists,"ARTISTS SEEN"],[venues,"VENUES VISITED"],[cities,"CITIES VISITED"]].map(([value,label]) => (
          <View key={label} style={styles.stat}>
            <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>
      {topArtistCount > 0 && <View style={styles.highlight}>
        <Text style={styles.tag}>MOST-SEEN ARTIST</Text>
        <Text style={styles.artist} numberOfLines={2} adjustsFontSizeToFit>{topArtist.toUpperCase()}</Text>
        <View style={styles.underline} />
        <Text style={styles.statLabel}>Seen {topArtistCount} {topArtistCount === 1 ? "time" : "times"}</Text>
      </View>}
    </ImageBackground>
  );
}

const cream = "#eee6d6";
const posterFont = Platform.OS === "ios" ? "AvenirNextCondensed-Heavy" : "sans-serif-condensed";
const styles = StyleSheet.create({
  card: {width: 400, height: 600, padding: 24, backgroundColor: "#161616", overflow:"hidden"},
  logo: {width: 150, height: 42, marginLeft: -12, marginBottom: 8},
  hero: {flexDirection:"row", alignItems:"center", gap: 12},
  frame: {width: 130, height: 166, padding: 5, paddingBottom: 15, backgroundColor: cream, transform:[{rotate:"-5deg"}]},
  photo: {width:"100%",height:"100%",resizeMode:"cover"},
  fallback: {flex:1,backgroundColor:"#292929",alignItems:"center",justifyContent:"center"},
  initial: {color:cream,fontSize:58,fontWeight:"900"},
  heroRight: {flex:1,minWidth:0},
  name: {color:cream,fontFamily:posterFont,fontSize:29,fontWeight:"900",marginBottom:-8,textAlign:"center"},
  paper: {height:110,justifyContent:"center",alignItems:"center",paddingHorizontal:24},
  total: {color:"#141414",fontFamily:posterFont,fontSize:57,fontWeight:"900",lineHeight:64,width:"100%",textAlign:"center",transform:[{translateY:4}]},
  label: {color:cream,fontSize:13,fontWeight:"900",textAlign:"center",marginTop:-12},
  stats: {flexDirection:"row",marginTop:16,paddingVertical:10,borderTopWidth:1,borderBottomWidth:1,borderColor:cream},
  stat: {flex:1,minWidth:0,alignItems:"center",paddingHorizontal:4},
  value: {color:cream,fontSize:39,fontWeight:"900",width:"100%",textAlign:"center"},
  statLabel: {color:cream,fontSize:11,fontWeight:"800",textAlign:"center"},
  highlight: {marginTop:9,alignItems:"flex-start",paddingHorizontal:10,paddingVertical:4},
  tag: {color:"#065fac",backgroundColor:cream,padding:5,fontSize:12,fontWeight:"900"},
  underline: {height:2,width:"65%",backgroundColor:"#168bff",transform:[{rotate:"-2deg"}],marginBottom:8},
  artist: {color:cream,fontFamily:posterFont,fontSize:36,fontWeight:"900",marginVertical:3,width:"100%"},
});
