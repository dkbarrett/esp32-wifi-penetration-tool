#!/bin/bash

if [ -z "$1" ] ; then
    echo "Missing argument - filename!"
    exit 1
fi

output_name=$(echo "$1" | sed 's/.html//')
output_filename="page_${output_name}.h"

echo """#ifndef PAGE_${output_name^^}_H
#define PAGE_${output_name^^}_H

// This file was generated using convert_html_to_header_file.sh""" > $output_filename

# Remove unnecessary whitespace and gzip
sed ':a;$!{N;ba;};s/@/@a/g;s/\n/@n/g;s/<script/\n&/g;s/<\/script>/&\n/g' $1 \
  | sed -r '/(^<script|<\/script>$)/!{s/@n//g;s/>\s+</></g;}' \
  | sed ':a;$!{N;ba;};s/\n//g;s/@n/\n/g;s/@a/@/g' |
  gzip --best > "page_${output_name}"

# Write to static array
xxd -i -u "page_${output_name}" >> $output_filename
rm "page_${output_name}"

echo -e "\n#endif" >> $output_filename

pages_location="../pages"
echo "Moving $output_filename to $pages_location/$output_filename"
mv $output_filename $pages_location/$output_filename
