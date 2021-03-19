#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
logtime=$(date "+%Y-%m-%dT%H:%M:%S")
everett="https://prepmod.doh.wa.gov/clinic/search?location=&search_radius=All&q%5Bvenue_search_name_or_venue_name_i_cont%5D=angel+of+the+winds&clinic_date_eq%5Byear%5D=&clinic_date_eq%5Bmonth%5D=&clinic_date_eq%5Bday%5D=&q%5Bvaccinations_name_i_cont%5D=&commit=Search"
evergreen="https://prepmod.doh.wa.gov/clinic/search?location=&search_radius=All&q%5Bvenue_search_name_or_venue_name_i_cont%5D=evergreen+state+fairgrounds&clinic_date_eq%5Byear%5D=&clinic_date_eq%5Bmonth%5D=&clinic_date_eq%5Bday%5D=&q%5Bvaccinations_name_i_cont%5D=&commit=Search"
arlington="https://prepmod.doh.wa.gov/clinic/search?location=&search_radius=All&q%5Bvenue_search_name_or_venue_name_i_cont%5D=Arlington+Airport&clinic_date_eq%5Byear%5D=&clinic_date_eq%5Bmonth%5D=&clinic_date_eq%5Bday%5D=&q%5Bvaccinations_name_i_cont%5D=&commit=Search"
bodal="https://prepmod.doh.wa.gov/clinic/search?location=98026&search_radius=10+miles&q%5Bvenue_search_name_or_venue_name_i_cont%5D=&clinic_date_eq%5Byear%5D=&clinic_date_eq%5Bmonth%5D=&clinic_date_eq%5Bday%5D=&q%5Bvaccinations_name_i_cont%5D=&commit=Search"

log() {
  printf "[$logtime] $@\n"
}

main() {
  local sitename="$1"
  local searchstring="${2:-No clinics to show.}"

  if [ -z $sitename ]; then
    log "Missing sitename [$sitename] or searchstring [$searchstring]"
    return 1;
  fi

  site=$(eval $"echo \${$sitename}")
  result=$(curl -s "$site")

  if `echo "$result" | grep -q "$searchstring"`; then
    log "No clinics."
    return 1;
  fi

  log "Time to register!"
  open "$site"
  echo 'Time to register!' | /usr/local/bin/terminal-notifier -title "Covid Alert! [$sitename]" -subtitle "Did not find text $searchstring" -sound sosumi -open "$site"

  return 0;
}

main "$@"
