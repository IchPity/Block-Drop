package game;

import java.awt.*;
import java.awt.image.BufferedImage;

public class Turm extends Figur {
    boolean ersterZug = true;
    public Turm( boolean isWhite, BufferedImage img) {
        super(isWhite, img);

    }

    public boolean isErsterZug() {
        return ersterZug;
    }

    public void setErsterZug(boolean ersterZug) {
        this.ersterZug = ersterZug;
    }
}
