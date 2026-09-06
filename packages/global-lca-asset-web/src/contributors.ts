// Publication acknowledgements, separate from the research dataset.
export const contributors: Array<{ name: string; affiliation?: string; surname: string }> = [
  {
    "name": "Zuhaib Batra",
    "affiliation": "EPFL Switzerland",
    "surname": "Batra"
  },
  {
    "name": "Tim Becker",
    "affiliation": "Carbon Minds GmbH",
    "surname": "Becker"
  },
  {
    "name": "Nicolas Martin Clauser",
    "affiliation": "Idaho National Laboratory",
    "surname": "Clauser"
  },
  {
    "name": "Elena Corella Puertas",
    "affiliation": "Technical University of Denmark",
    "surname": "Corella Puertas"
  },
  {
    "name": "Tomas Ekvall",
    "affiliation": "TERRA",
    "surname": "Ekvall"
  },
  {
    "name": "Leonardo Ferhati",
    "affiliation": "DTU",
    "surname": "Ferhati"
  },
  {
    "name": "Stefan Füchsl",
    "affiliation": "Hochschule Weihenstephan-Triesdorf HSWT at TUM Campus Straubing",
    "surname": "Füchsl"
  },
  {
    "name": "Tim Grant",
    "affiliation": "Lifecycles",
    "surname": "Grant"
  },
  {
    "name": "Lise Laurin",
    "affiliation": "EarthShift Global",
    "surname": "Laurin"
  },
  {
    "name": "Cara Lynn McHardy",
    "affiliation": "Flanders Research Institute for Agriculture, Fisheries and Food",
    "surname": "McHardy"
  },
  {
    "name": "Raoul Meys",
    "affiliation": "Carbon Minds GmbH",
    "surname": "Meys"
  },
  {
    "name": "Pranav Mithra",
    "affiliation": "Forvia Automotive Seating",
    "surname": "Mithra"
  },
  {
    "name": "Clemens Mostert",
    "affiliation": "University of Kassel",
    "surname": "Mostert"
  },
  {
    "name": "Matt Putkoski",
    "affiliation": "Radiant Earth",
    "surname": "Putkoski"
  },
  {
    "name": "Caterina Rinaldi",
    "affiliation": "ENEA",
    "surname": "Rinaldi"
  },
  {
    "name": "Alba Roibas Rozas",
    "affiliation": "Royal Cosun",
    "surname": "Roibas Rozas"
  },
  {
    "name": "François Saunier",
    "affiliation": "CIRAIG",
    "surname": "Saunier"
  },
  {
    "name": "José Paulo Pereira das Dores Savioli",
    "affiliation": "Universidade Tecnológica Federal do Paraná (UTFPR) | Embrapa Meio Ambiente | Instituto Brasileiro de Informação em Ciência e Tecnologia (IBICT)",
    "surname": "Savioli"
  },
  {
    "name": "Dalila Taieb",
    "affiliation": "National Agency for Environment Protection in Tunisia",
    "surname": "Taieb"
  },
  {
    "name": "NAVEEN KUMAR VIPPARLA",
    "affiliation": "EATON",
    "surname": "VIPPARLA"
  },
  {
    "name": "Kerstin von Borries",
    "affiliation": "Technical University of Denmark",
    "surname": "Borries"
  },
  {
    "name": "Paige Weiler",
    "affiliation": "ERG",
    "surname": "Weiler"
  },
  {
    "name": "Ariane",
    "affiliation": "Aston University",
    "surname": ""
  },
  {
    "name": "Lily",
    "affiliation": "HANGZHOU GREEN AND CLEAN ENVIRONMENTAL TECH",
    "surname": ""
  },
  {
    "name": "Paniz",
    "affiliation": "KU Leuven",
    "surname": ""
  }
].sort((a, b) => Number(!a.surname) - Number(!b.surname) || a.surname.localeCompare(b.surname, "en", { sensitivity: "base" }) || a.name.localeCompare(b.name, "en"));
