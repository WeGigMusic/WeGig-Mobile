import React from "react";
import { Image, ImageBackground, ImageSourcePropType, StyleSheet, Text, View } from "react-native";

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
  const possessive = /s$/i.test(name) ? name + "'" : name + "'s";
  return (
    <ImageBackground source={require("../../assets/share/profile-background.png")} style={styles.card} resizeMode="stretch">
      <Image source={require("../../assets/wegig-logo.png")} style={styles.logo} resizeMode="contain" />
      <View style={styles.hero}>
        <View style={styles.frame}>
          <View style={styles.photoWindow}>
            {avatar ? <Image source={avatar} style={styles.photo} /> : <View style={styles.fallback}><Text style={styles.initial}>{name.charAt(0).toUpperCase()}</Text></View>}
          </View>
          <Image source={require("../../assets/share/photo-frame.png")} style={styles.frameOverlay} resizeMode="stretch" />
        </View>
        <View style={styles.heroRight}>
          <ImageBackground source={require("../../assets/share/cream-paper.png")} style={styles.namePaper} resizeMode="stretch">
            <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit>{possessive.toUpperCase()}</Text>
          </ImageBackground>
          <ImageBackground source={require("../../assets/share/blue-paper-large.png")} style={styles.paper} resizeMode="stretch">
            <Text style={styles.total} numberOfLines={1} adjustsFontSizeToFit>{total}</Text>
            <Text style={styles.label}>GIGS ATTENDED</Text>
          </ImageBackground>
        </View>
      </View>
      <View style={styles.stats}>
        {[[artists,"ARTISTS SEEN"],[venues,"VENUES VISITED"],[cities,"CITIES VISITED"]].map(([value,label], index) => (
          <View key={label} style={[styles.stat, index > 0 && styles.statDivider]}>
            <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>
      {topArtistCount > 0 && <View style={styles.highlight}>
        <ImageBackground source={require("../../assets/share/cream-paper.png")} style={styles.tagPaper} resizeMode="stretch">
          <Text style={styles.tag}>MOST-SEEN ARTIST</Text>
        </ImageBackground>
        <Text style={styles.artist} numberOfLines={2} adjustsFontSizeToFit>{topArtist.toUpperCase()}</Text>
        <Image source={require("../../assets/share/blue-underline.png")} style={styles.underline} resizeMode="stretch" />
        <Text style={styles.statLabel}>Seen {topArtistCount} {topArtistCount === 1 ? "time" : "times"}</Text>
      </View>}
    </ImageBackground>
  );
}

const cream = "#eee6d6";
const styles = StyleSheet.create({
  card: {width:400,height:600,paddingHorizontal:22,paddingTop:18,backgroundColor:"#161616",overflow:"hidden"},
  logo: {width:180,height:42,marginLeft:-20,marginBottom:0,opacity:0.84},
  hero: {flexDirection:"row",alignItems:"center",gap:7},
  frame: {width:153,height:184,justifyContent:"center",alignItems:"center"},
  photoWindow: {width:126,height:155,overflow:"hidden",transform:[{rotate:"-7deg"}]},
  photo: {width:"100%",height:"100%",resizeMode:"cover"},
  frameOverlay: {...StyleSheet.absoluteFillObject,width:"100%",height:"100%"},
  fallback: {flex:1,backgroundColor:"#292929",alignItems:"center",justifyContent:"center"},
  initial: {color:cream,fontSize:58,fontWeight:"900"},
  heroRight: {flex:1,minWidth:0},
  namePaper: {height:43,justifyContent:"center",paddingHorizontal:16},
  name: {color:"#141414",fontSize:21,fontWeight:"900",textAlign:"center",transform:[{rotate:"-4deg"}]},
  paper: {height:174,justifyContent:"center",alignItems:"center",paddingHorizontal:19,paddingTop:15,paddingBottom:12},
  total: {color:"#141414",fontSize:82,fontWeight:"900",lineHeight:88,width:"100%",textAlign:"center"},
  label: {color:"#141414",fontSize:16,fontWeight:"900",textAlign:"center",marginTop:-8},
  stats: {flexDirection:"row",marginTop:12,paddingBottom:12,borderBottomWidth:1,borderColor:cream},
  stat: {flex:1,minWidth:0,alignItems:"center",paddingHorizontal:5},
  statDivider: {borderLeftWidth:1,borderLeftColor:cream},
  value: {color:cream,fontSize:39,fontWeight:"900",width:"100%",textAlign:"center"},
  statLabel: {color:cream,fontSize:11,fontWeight:"800",textAlign:"center"},
  highlight: {marginTop:8,alignItems:"flex-start",paddingHorizontal:3},
  tagPaper: {width:178,height:35,justifyContent:"center",paddingHorizontal:12},
  tag: {color:"#065fac",fontSize:13,fontWeight:"900",textAlign:"center",transform:[{rotate:"-3deg"}]},
  artist: {color:cream,fontSize:34,fontWeight:"900",width:"100%",transform:[{rotate:"-2deg"}]},
  underline: {width:210,height:25,marginTop:-4},
});
