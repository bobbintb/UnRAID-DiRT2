#!/bin/bash

PLUGIN_NAME="bobbintb.system.dirt"
set -o pipefail
echo "-----------------------------------------------------------"
echo "Checking dependencies for $PLUGIN_NAME..."
echo "-----------------------------------------------------------"

install_package() {
    URL="$1"
    NAME="$2"
    FILE=$(basename "$URL")
    BASE_URL=$(dirname "$URL")/
    EXT="${URL##*.}"
    TXZ_PATH="/boot/config/plugins/${PLUGIN_NAME}/${FILE}"
    FILE_BASE="${FILE%.*}"
    if [ ! -f "$TXZ_PATH" ]; then
        echo "-----------------------------------------------------------"
        echo "$FILE is not cached."
        echo "Downloading $NAME..."
        echo "-----------------------------------------------------------"
        if ! wget --spider "$URL" 2>/dev/null; then
            echo "  File $FILE not found. Searching for"
            echo "  .$EXT files in $BASE_URL..."
            FIRST_FILE=$(wget -q -O - "$BASE_URL" | grep -oE "href=\"[^\"]*${NAME}[^\"]*\.${EXT}\"" | head -n 1 | cut -d'"' -f2) || FIRST_FILE=$(wget -q -O - "$BASE_URL" | grep -oP '(?&amp;lt;=&amp;lt;script type="application/json" data-target="react-app.embeddedData">).*?(?=&amp;lt;/script>)' | jq -r '.payload.tree.items[] | select(.name | test("^'"$NAME"'") and test("'"$EXT"'$")) | .name')
            if [ -n "$FIRST_FILE" ]; then
                echo "  $FILE was not found but $FIRST_FILE was."
                echo "  The package was likely updated and the old file removed."
                echo "  We'll use the new file for now but please alert the plugin"
                echo "  author if this is not resolved soon."
                install_package "$BASE_URL$FIRST_FILE" "$NAME"
            else
                echo "  $FILE was not found, nor any other package files at that URL."
                echo "  Please alert the plugin author of this error."
            fi
            rm "$TXZ_PATH"
        else
            curl -L "$URL" --create-dirs -o "$TXZ_PATH"
            #wget "$URL" -O "$TXZ_PATH"
        fi
    fi

    if [ -n "$3" ]; then
            condition="[ ! -f $3$FILE ] >/dev/null 2>&amp;1"
        else
            condition="[ ! -f "/var/log/packages/${FILE_BASE}" ] >/dev/null 2>&amp;1"
    fi

    if eval "$condition"; then
        echo "-----------------------------------------------------------"
        echo "$NAME is not installed."
        echo "Installing $NAME..."
        echo "-----------------------------------------------------------"

        if [ -n "$3" ]; then
          mkdir -p "$3"
            if [[ "$FILE" == *.tar.gz || "$FILE" == *.tar.xz ]]; then
                tar --one-top-level="$FILE" -xf "$FILE" -C /tmp
                mv /tmp/"$FILE"/ "$3"
                chmod -R 755 "$3"
                rm -dr /tmp/"$FILE"/
            else
                install -Dm755 "/boot/config/plugins/${PLUGIN_NAME}/$FILE" "$3"
            fi
          else
              installpkg "$TXZ_PATH"
          fi
    fi
}

declare -A urls
urls["https://bobbintb.github.io/Slackware_Packages/builds/valkey/valkey-8.1.3-x86_64-2_SBo.tgz"]="valkey"
urls["https://bobbintb.github.io/Slackware_Packages/builds/redisearch/redisearch-2.10.17-x86_64-1_SBo.tgz"]="redisearch"

for url in "${!urls[@]}"; do
  install_package "$url" "${urls[$url]}"
done

echo "Done."
