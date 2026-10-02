// ── MANAGEMENT TEAM DATA ──────────────────────────────────
// mp=Managing Partner, dm=District Manager, lm=Location Manager
// am[]=Asst Manager(s), sup[]=Supervisor(s)
export const MGMT = {
  1:  { mp:null,               dm:'Michael Mastrangelo',   lm:'Tyler DeGrange',                       am:['Michael Morris'],                                 sup:['Open'] },
  2:  { mp:null,               dm:'Michael Mastrangelo',   lm:'Cristian Botero',                      am:['John Strott'],                                  sup:['Jose Jandres'] },
  3:  { mp:null,               dm:'James "JT" Kelley',     lm:'Brian Haire',                          am:['Cesar Quinteros'],                                sup:['Lorraine Eiland'] },
  4:  { mp:null,               dm:'Mike Clark',            lm:'Aaron Gotthardt',                      am:['Nicqolas Clements'],                              sup:[] },
  5:  { mp:null,               dm:'Michael Mastrangelo',   lm:'Jorge Lacayo',                         am:['Carl Kongo'],                                    sup:['Abi Bonilla-Barillas'] },
  6:  { mp:'Megan Solomon',   dm:'Roy Whitehead',         lm:'Erik Borkman',                         am:['Willian Reyes','Aaron Bravo'],                    sup:['Astrid Perez'] },
  7:  { mp:null,               dm:'James "JT" Kelley',     lm:'Shane Seales',                         am:['Shelton Willett','Mekhi Anderson'],              sup:[] },
  8:  { mp:'Megan Solomon',   dm:'Roy Whitehead',         lm:'Daniel Martinez',                      am:['Anthony Tran'],                                   sup:['Open'] },
  9:  { mp:null,               dm:'Michael Mastrangelo',   lm:'José "JR" Diosdado-Quintana',          am:['Enrique Alfaro'],                                 sup:['Open'] },
  10: { mp:null,               dm:'Mike Clark',            lm:'Clyde McGee',                          am:['John Smithers'],                                  sup:[] },
  11: { mp:null,               dm:'James "JT" Kelley',     lm:'Ismaila "Ismail" Bangura',             am:['Sean Smith','Dustardi Davis'],                    sup:[] },
  12: { mp:null,               dm:'Michael Mastrangelo',   lm:'Alec Shackett',                        am:['Marriah Gunder'],                                 sup:['Wendi Molina','Matthew Guivas'] },
  14: { mp:'Megan Solomon',   dm:'Roy Whitehead',         lm:'Erik Borkman (temporary)',             am:['Monica Aguilar Pena'],                            sup:['Ginger Reagle'] },
  15: { mp:null,               dm:'James "JT" Kelley',     lm:'Irwin Kelly',                          am:['Kyle Allen'],                                     sup:['Open'] },
  16: { mp:null,               dm:'James "JT" Kelley',     lm:'Bruce Haire',                          am:['Cooper Taylor'],                                  sup:['Elliot Rojas'] },
  17: { mp:null,               dm:'James "JT" Kelley',     lm:'Nathan "Nate" Markle',                 am:['Brandon Little'],                                 sup:['Open'] },
  19: { mp:'Megan Solomon',   dm:'Megan Monroe (interim)',lm:'Jose Velez',                           am:['Paige Pollard'],                                 sup:['Nicholas Tunzi','Brandon Imwold'] },
  20: { mp:'Megan Solomon',   dm:null,                    lm:'Samantha "Sam" Taylor',                am:[],                                                 sup:['Joshua Copp'] },
  21: { mp:'Megan Solomon',   dm:'Megan Monroe (interim)',lm:'Peter Martin',                         am:['Jacob Chilcoat'],                                 sup:['Ignacio Rodriguez','Triston Barzey'] },
  22: { mp:null,               dm:'James "JT" Kelley',     lm:'Dakota Belcher',                       am:['Walter Benitez','Kristen Alvarez'],               sup:[] },
  23: { mp:'Megan Solomon',   dm:'Megan Monroe (interim)',lm:'Garrett Mayhew',                       am:['Maura Rivera Ramos'],                             sup:['Jonathan Hacen','Bill McKenna'] },
  24: { mp:'Megan Solomon',   dm:'Megan Solomon (interim)', lm:'Joseph Youngblood',                  am:['Levi Lauer'],                                    sup:['Thomas "Tom" Hollway','Damian Smith','Karley Atwell','Wallesca Cordero'] },
  25: { mp:'Megan Solomon',   dm:'Megan Solomon (interim)', lm:'Daeshawn Covington',                 am:['Desmone Collins'],                                sup:['Malei Hawkins','Marquise Higgs'] },
  26: { mp:'Megan Solomon',   dm:'Megan Monroe (interim)',lm:'Jamila Mitchell',                      am:['Donte Winfield'],                                sup:['Ella Martin','Marcus Randolph','Yasmine Muse'] },
  27: { mp:'Megan Solomon',   dm:'Roy Whitehead (interim)', lm:'Demetrius "Demi" Wilson',            am:['Michael Shorter'],                               sup:['Tariq Robinson','Jordan Keller'] },
  28: { mp:'Megan Solomon',   dm:'Megan Monroe',          lm:'Carla Castellon',                      am:['Kimberly "Kym" Hart'],                            sup:['Kimberly Pett','Sigourney Rodriguez'] },
  31: { mp:'Megan Solomon',   dm:'Roy Whitehead (interim)', lm:['Jada Jordan','Ben Martucci'],       am:['Ethyn Benning'],                                 sup:['Quincy Brown','Talha Meher'] },
  32: { mp:'Megan Solomon',   dm:'Megan Monroe',          lm:'Douglas Breeden',                      am:['Ryan Ross'],                                      sup:['Ashauna Calder','Kevin Kretzer'] },
  33: { mp:'Megan Solomon',   dm:'Megan Monroe',          lm:'Jada Jordan',                          am:['Ijanai Harris'],                                  sup:['Anthony Branch','Ekim Elijah Davis'] },
  35: { mp:'Megan Solomon',   dm:'Megan Monroe',          lm:'Felicia Fitez',                        am:['Jessica Stumbo'],                                sup:['Hunter Smith','Spencer Sharpley'] },
};

/* ══ SCHEDULED ROSTER CHANGES ══════════════════════════════
   Transfers announced ahead of their effective date. Each one applies from
   midnight Eastern on `from`, so the app changes over on the day without
   anyone redeploying. Once a date has passed, fold the change into MGMT at
   the next roster sync and delete it here. */
export const ROSTER_CHANGES = [
  // HR notice, TLC #13 closure (Leah Bolger, 1 Oct 2026)
  { from: '2026-10-04', num: 2, role: 'am', add: 'Jackson Krasche' },
];
