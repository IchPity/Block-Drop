package game;

import java.awt.*;
import java.awt.image.BufferedImage;

public class Koenig extends Figur{
    boolean ersterZug = true;
    public Koenig( boolean isWhite, BufferedImage img) {
        super( isWhite, img);

    }

    public boolean isErsterZug() {
        return ersterZug;
    }

    public void setErsterZug(boolean ersterZug) {
        this.ersterZug = ersterZug;
    }
}
